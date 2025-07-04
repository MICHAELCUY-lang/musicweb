// Main Application Class
class MusicTogether {
  constructor() {
    this.currentRoom = null;
    this.currentUser = null;
    this.isHost = false;
    this.isPlaying = false;
    this.currentVideoId = null;
    this.searchResults = [];
    this.queue = [];
    this.users = [];
    this.messages = [];

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupYouTubePlayer();
    this.setupWebSocket();
    this.loadStoredData();
  }

  setupEventListeners() {
    // Room controls
    document
      .getElementById("join-btn")
      .addEventListener("click", () => this.joinRoom());
    document
      .getElementById("create-btn")
      .addEventListener("click", () => this.createRoom());
    document
      .getElementById("set-username")
      .addEventListener("click", () => this.setUsername());

    // Search functionality
    document
      .getElementById("search-btn")
      .addEventListener("click", () => this.searchVideos());
    document
      .getElementById("search-input")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.searchVideos();
      });

    // Player controls
    document
      .getElementById("play-btn")
      .addEventListener("click", () => this.playVideo());
    document
      .getElementById("pause-btn")
      .addEventListener("click", () => this.pauseVideo());
    document
      .getElementById("volume-btn")
      .addEventListener("click", () => this.toggleMute());
    document
      .getElementById("volume-slider")
      .addEventListener("input", (e) => this.setVolume(e.target.value));

    // Chat functionality
    document
      .getElementById("send-btn")
      .addEventListener("click", () => this.sendMessage());
    document
      .getElementById("message-input")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.sendMessage();
      });

    // Progress bar
    document
      .querySelector(".progress-bar")
      .addEventListener("click", (e) => this.seekTo(e));
  }

  setupYouTubePlayer() {
    window.onYouTubeIframeAPIReady = () => {
      this.player = new YT.Player("youtube-player", {
        height: "300",
        width: "100%",
        videoId: "",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
        },
        events: {
          onReady: (event) => this.onPlayerReady(event),
          onStateChange: (event) => this.onPlayerStateChange(event),
        },
      });
    };
  }

  setupWebSocket() {
    this.websocket = new WebSocketManager();
    this.websocket.onMessage = (data) => this.handleWebSocketMessage(data);
    this.websocket.onConnect = () => this.onWebSocketConnect();
    this.websocket.onDisconnect = () => this.onWebSocketDisconnect();
  }

  loadStoredData() {
    // Load from memory storage since localStorage is not available
    const savedUsername = this.getStoredData("username");
    const savedRoom = this.getStoredData("currentRoom");

    if (savedUsername) {
      document.getElementById("username-input").value = savedUsername;
      this.currentUser = savedUsername;
    }

    if (savedRoom) {
      document.getElementById("room-input").value = savedRoom;
    }
  }

  // Room Management
  async createRoom() {
    const username = this.getCurrentUsername();
    if (!username) {
      this.showError("Please set your username first");
      return;
    }

    this.showLoading(true);

    try {
      const roomCode = this.generateRoomCode();
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, host: username }),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentRoom = data.roomCode;
        this.isHost = true;
        this.joinWebSocketRoom(data.roomCode);
        this.updateRoomStatus(`Room: ${data.roomCode} (Host)`);
        this.storeData("currentRoom", data.roomCode);
        document.getElementById("room-input").value = data.roomCode;
      } else {
        this.showError("Failed to create room");
      }
    } catch (error) {
      this.showError("Error creating room: " + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  async joinRoom() {
    const roomCode = document.getElementById("room-input").value.trim();
    const username = this.getCurrentUsername();

    if (!roomCode || !username) {
      this.showError("Please enter room code and username");
      return;
    }

    this.showLoading(true);

    try {
      const response = await fetch(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentRoom = roomCode;
        this.isHost = false;
        this.joinWebSocketRoom(roomCode);
        this.updateRoomStatus(`Room: ${roomCode}`);
        this.storeData("currentRoom", roomCode);

        // Load current room state
        if (data.currentVideo) {
          this.loadVideo(
            data.currentVideo.videoId,
            data.currentVideo.startTime
          );
        }

        this.queue = data.queue || [];
        this.updateQueueDisplay();
      } else {
        this.showError("Failed to join room");
      }
    } catch (error) {
      this.showError("Error joining room: " + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  setUsername() {
    const username = document.getElementById("username-input").value.trim();
    if (username) {
      this.currentUser = username;
      this.storeData("username", username);
      this.showSuccess("Username set successfully");
    }
  }

  // Video Search and Management
  async searchVideos() {
    const query = document.getElementById("search-input").value.trim();
    if (!query) return;

    this.showLoading(true);

    try {
      const videos = await YouTubeAPI.search(query);
      this.searchResults = videos;
      this.displaySearchResults(videos);
    } catch (error) {
      this.showError("Error searching videos: " + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  displaySearchResults(videos) {
    const resultsContainer = document.getElementById("search-results");
    resultsContainer.innerHTML = "";

    videos.forEach((video) => {
      const videoElement = document.createElement("div");
      videoElement.className = "video-result";
      videoElement.innerHTML = `
              <img src="${video.thumbnail}" alt="${video.title}">
              <div class="video-info">
                  <h4>${video.title}</h4>
                  <p>${video.channel} • ${video.duration}</p>
              </div>
          `;

      videoElement.addEventListener("click", () => this.addToQueue(video));
      resultsContainer.appendChild(videoElement);
    });
  }

  addToQueue(video) {
    if (!this.currentRoom) {
      this.showError("Please join a room first");
      return;
    }

    this.queue.push(video);
    this.updateQueueDisplay();

    // Send to other users via WebSocket
    this.websocket.send({
      type: "add_to_queue",
      video: video,
      room: this.currentRoom,
    });

    this.showSuccess(`Added "${video.title}" to queue`);
  }

  updateQueueDisplay() {
    const queueContainer = document.getElementById("queue-list");

    if (this.queue.length === 0) {
      queueContainer.innerHTML =
        '<p class="empty-queue">No videos in queue</p>';
      return;
    }

    queueContainer.innerHTML = "";
    this.queue.forEach((video, index) => {
      const queueItem = document.createElement("div");
      queueItem.className = "queue-item";
      queueItem.innerHTML = `
              <img src="${video.thumbnail}" alt="${video.title}">
              <div class="queue-item-info">
                  <h5>${video.title}</h5>
                  <p>${video.channel} • ${video.duration}</p>
              </div>
              <button class="remove-btn" onclick="app.removeFromQueue(${index})">Remove</button>
          `;
      queueContainer.appendChild(queueItem);
    });
  }

  removeFromQueue(index) {
    if (index >= 0 && index < this.queue.length) {
      const removed = this.queue.splice(index, 1)[0];
      this.updateQueueDisplay();

      // Send to other users via WebSocket
      this.websocket.send({
        type: "remove_from_queue",
        index: index,
        room: this.currentRoom,
      });

      this.showSuccess(`Removed "${removed.title}" from queue`);
    }
  }

  // Video Player Controls
  onPlayerReady(event) {
    this.playerReady = true;
    this.updatePlayerControls();

    // Start progress update interval
    this.progressInterval = setInterval(() => {
      this.updateProgress();
    }, 1000);
  }

  onPlayerStateChange(event) {
    const state = event.data;

    if (state === YT.PlayerState.PLAYING) {
      this.isPlaying = true;
      this.syncPlayState();
    } else if (state === YT.PlayerState.PAUSED) {
      this.isPlaying = false;
      this.syncPlayState();
    } else if (state === YT.PlayerState.ENDED) {
      this.playNext();
    }

    this.updatePlayerControls();
  }

  loadVideo(videoId, startTime = 0) {
    if (!this.playerReady) return;

    this.currentVideoId = videoId;
    this.player.loadVideoById(videoId, startTime);

    // Update video info
    const video = this.findVideoById(videoId);
    if (video) {
      document.getElementById("current-title").textContent = video.title;
      document.getElementById("current-channel").textContent = video.channel;
    }
  }

  playVideo() {
    if (!this.playerReady || !this.currentVideoId) return;

    this.player.playVideo();
    this.broadcastPlayerAction("play");
  }

  pauseVideo() {
    if (!this.playerReady || !this.currentVideoId) return;

    this.player.pauseVideo();
    this.broadcastPlayerAction("pause");
  }

  playNext() {
    if (this.queue.length > 0) {
      const nextVideo = this.queue.shift();
      this.loadVideo(nextVideo.videoId);
      this.updateQueueDisplay();

      // Broadcast to other users
      this.websocket.send({
        type: "play_next",
        video: nextVideo,
        room: this.currentRoom,
      });
    }
  }

  seekTo(event) {
    if (!this.playerReady || !this.currentVideoId) return;

    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const duration = this.player.getDuration();
    const seekTime = duration * percent;

    this.player.seekTo(seekTime);
    this.broadcastPlayerAction("seek", seekTime);
  }

  setVolume(volume) {
    if (!this.playerReady) return;

    this.player.setVolume(volume);
    this.updateVolumeIcon(volume);
  }

  toggleMute() {
    if (!this.playerReady) return;

    if (this.player.isMuted()) {
      this.player.unMute();
      document.getElementById("volume-btn").innerHTML =
        '<span class="icon">🔊</span>';
    } else {
      this.player.mute();
      document.getElementById("volume-btn").innerHTML =
        '<span class="icon">🔇</span>';
    }
  }

  updateProgress() {
    if (!this.playerReady || !this.currentVideoId) return;

    const currentTime = this.player.getCurrentTime();
    const duration = this.player.getDuration();
    const percent = (currentTime / duration) * 100;

    document.getElementById("progress-fill").style.width = percent + "%";
    document.getElementById("current-time").textContent =
      this.formatTime(currentTime);
    document.getElementById("total-time").textContent =
      this.formatTime(duration);
  }

  updatePlayerControls() {
    const playBtn = document.getElementById("play-btn");
    const pauseBtn = document.getElementById("pause-btn");

    if (this.isPlaying) {
      playBtn.style.display = "none";
      pauseBtn.style.display = "block";
    } else {
      playBtn.style.display = "block";
      pauseBtn.style.display = "none";
    }
  }

  updateVolumeIcon(volume) {
    const volumeBtn = document.getElementById("volume-btn");
    if (volume == 0) {
      volumeBtn.innerHTML = '<span class="icon">🔇</span>';
    } else if (volume < 50) {
      volumeBtn.innerHTML = '<span class="icon">🔉</span>';
    } else {
      volumeBtn.innerHTML = '<span class="icon">🔊</span>';
    }
  }

  // Chat System
  sendMessage() {
    const messageInput = document.getElementById("message-input");
    const message = messageInput.value.trim();

    if (!message || !this.currentRoom || !this.currentUser) return;

    const messageData = {
      type: "chat_message",
      room: this.currentRoom,
      username: this.currentUser,
      message: message,
      timestamp: new Date().toISOString(),
    };

    this.websocket.send(messageData);
    messageInput.value = "";
  }

  displayMessage(messageData) {
    const messagesContainer = document.getElementById("chat-messages");
    const messageElement = document.createElement("div");
    messageElement.className = "chat-message";

    const time = new Date(messageData.timestamp).toLocaleTimeString();
    messageElement.innerHTML = `
          <span class="username">${messageData.username}:</span>
          <span class="message">${messageData.message}</span>
          <span class="timestamp">${time}</span>
      `;

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // WebSocket Event Handlers
  handleWebSocketMessage(data) {
    switch (data.type) {
      case "user_joined":
        this.addUser(data.username);
        this.displaySystemMessage(`${data.username} joined the room`);
        break;

      case "user_left":
        this.removeUser(data.username);
        this.displaySystemMessage(`${data.username} left the room`);
        break;

      case "chat_message":
        this.displayMessage(data);
        break;

      case "add_to_queue":
        this.queue.push(data.video);
        this.updateQueueDisplay();
        break;

      case "remove_from_queue":
        this.queue.splice(data.index, 1);
        this.updateQueueDisplay();
        break;

      case "play_video":
        if (data.videoId !== this.currentVideoId) {
          this.loadVideo(data.videoId, data.startTime);
        }
        break;

      case "player_action":
        this.handlePlayerAction(data);
        break;

      case "play_next":
        this.loadVideo(data.video.videoId);
        break;

      case "sync_state":
        this.syncWithRoom(data);
        break;
    }
  }

  handlePlayerAction(data) {
    if (!this.playerReady) return;

    switch (data.action) {
      case "play":
        this.player.playVideo();
        break;
      case "pause":
        this.player.pauseVideo();
        break;
      case "seek":
        this.player.seekTo(data.time);
        break;
    }
  }

  syncWithRoom(data) {
    if (data.currentVideo) {
      this.loadVideo(data.currentVideo.videoId, data.currentVideo.currentTime);
    }

    this.queue = data.queue || [];
    this.updateQueueDisplay();

    this.users = data.users || [];
    this.updateUsersDisplay();
  }

  // User Management
  addUser(username) {
    if (!this.users.find((user) => user.username === username)) {
      this.users.push({ username, status: "online" });
      this.updateUsersDisplay();
    }
  }

  removeUser(username) {
    this.users = this.users.filter((user) => user.username !== username);
    this.updateUsersDisplay();
  }

  updateUsersDisplay() {
    const usersContainer = document.getElementById("users-list");
    const usersCount = document.getElementById("users-count");

    usersCount.textContent = this.users.length;

    if (this.users.length === 0) {
      usersContainer.innerHTML = "<p>No users in room</p>";
      return;
    }

    usersContainer.innerHTML = "";
    this.users.forEach((user) => {
      const userElement = document.createElement("div");
      userElement.className = "user-item";
      userElement.innerHTML = `
              <div class="user-avatar">${user.username
                .charAt(0)
                .toUpperCase()}</div>
              <span>${user.username}</span>
              <span class="user-status ${user.status}">${user.status}</span>
          `;
      usersContainer.appendChild(userElement);
    });
  }

  // Broadcasting and Sync
  broadcastPlayerAction(action, data = null) {
    if (!this.currentRoom) return;

    const message = {
      type: "player_action",
      room: this.currentRoom,
      action: action,
      videoId: this.currentVideoId,
      time: this.player.getCurrentTime(),
    };

    if (data !== null) {
      message.data = data;
    }

    this.websocket.send(message);
  }

  syncPlayState() {
    if (!this.currentRoom) return;

    this.websocket.send({
      type: "sync_play_state",
      room: this.currentRoom,
      isPlaying: this.isPlaying,
      currentTime: this.player.getCurrentTime(),
      videoId: this.currentVideoId,
    });
  }

  joinWebSocketRoom(roomCode) {
    this.websocket.send({
      type: "join_room",
      room: roomCode,
      username: this.currentUser,
    });
  }

  // WebSocket Connection Handlers
  onWebSocketConnect() {
    this.updateRoomStatus(
      this.currentRoom ? `Room: ${this.currentRoom}` : "Connected"
    );
  }

  onWebSocketDisconnect() {
    this.updateRoomStatus("Disconnected");
  }

  // Utility Methods
  getCurrentUsername() {
    return (
      this.currentUser || document.getElementById("username-input").value.trim()
    );
  }

  generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  findVideoById(videoId) {
    return (
      this.searchResults.find((video) => video.videoId === videoId) ||
      this.queue.find((video) => video.videoId === videoId)
    );
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  updateRoomStatus(status) {
    document.getElementById("room-status").textContent = status;
  }

  displaySystemMessage(message) {
    const messagesContainer = document.getElementById("chat-messages");
    const messageElement = document.createElement("div");
    messageElement.className = "chat-message system-message";
    messageElement.innerHTML = `
          <span class="username">System:</span>
          <span class="message">${message}</span>
          <span class="timestamp">${new Date().toLocaleTimeString()}</span>
      `;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  showLoading(show) {
    const overlay = document.getElementById("loading-overlay");
    if (show) {
      overlay.classList.add("show");
    } else {
      overlay.classList.remove("show");
    }
  }

  showError(message) {
    alert("Error: " + message);
  }

  showSuccess(message) {
    alert("Success: " + message);
  }

  // Memory storage methods (since localStorage is not available)
  storeData(key, value) {
    if (!window.memoryStorage) {
      window.memoryStorage = {};
    }
    window.memoryStorage[key] = value;
  }

  getStoredData(key) {
    if (!window.memoryStorage) {
      return null;
    }
    return window.memoryStorage[key];
  }
}

// Initialize the application
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new MusicTogether();
});

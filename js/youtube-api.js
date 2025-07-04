// YouTube API Handler
class YouTubeAPI {
  static API_KEY = "YOUR_YOUTUBE_API_KEY_HERE"; // Replace with your actual API key
  static BASE_URL = "https://www.googleapis.com/youtube/v3";

  static async search(query, maxResults = 10) {
    try {
      const url = `${
        this.BASE_URL
      }/search?part=snippet&type=video&q=${encodeURIComponent(
        query
      )}&maxResults=${maxResults}&key=${this.API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      // Get video details including duration
      const videoIds = data.items.map((item) => item.id.videoId).join(",");
      const videoDetails = await this.getVideoDetails(videoIds);

      return data.items.map((item) => {
        const details = videoDetails.find(
          (detail) => detail.id === item.id.videoId
        );
        return {
          videoId: item.id.videoId,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.medium.url,
          duration: details
            ? this.formatDuration(details.contentDetails.duration)
            : "Unknown",
          publishedAt: item.snippet.publishedAt,
          description: item.snippet.description,
        };
      });
    } catch (error) {
      console.error("YouTube API search error:", error);
      throw error;
    }
  }

  static async getVideoDetails(videoIds) {
    try {
      const url = `${this.BASE_URL}/videos?part=contentDetails&id=${videoIds}&key=${this.API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.items;
    } catch (error) {
      console.error("YouTube API video details error:", error);
      return [];
    }
  }

  static async getVideoInfo(videoId) {
    try {
      const url = `${this.BASE_URL}/videos?part=snippet,contentDetails&id=${videoId}&key=${this.API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.items.length === 0) {
        throw new Error("Video not found");
      }

      const video = data.items[0];
      return {
        videoId: video.id,
        title: video.snippet.title,
        channel: video.snippet.channelTitle,
        thumbnail: video.snippet.thumbnails.medium.url,
        duration: this.formatDuration(video.contentDetails.duration),
        publishedAt: video.snippet.publishedAt,
        description: video.snippet.description,
      };
    } catch (error) {
      console.error("YouTube API video info error:", error);
      throw error;
    }
  }

  static formatDuration(duration) {
    // Convert ISO 8601 duration to readable format
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

    if (!match) return "Unknown";

    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  }

  static extractVideoId(url) {
    // Extract video ID from various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  static isValidVideoId(videoId) {
    // Basic validation for YouTube video ID format
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  }

  static getThumbnailUrl(videoId, quality = "medium") {
    const qualities = {
      default: "default.jpg",
      medium: "mqdefault.jpg",
      high: "hqdefault.jpg",
      standard: "sddefault.jpg",
      maxres: "maxresdefault.jpg",
    };

    const filename = qualities[quality] || qualities["medium"];
    return `https://img.youtube.com/vi/${videoId}/${filename}`;
  }

  static getWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  static async searchPlaylists(query, maxResults = 10) {
    try {
      const url = `${
        this.BASE_URL
      }/search?part=snippet&type=playlist&q=${encodeURIComponent(
        query
      )}&maxResults=${maxResults}&key=${this.API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      return data.items.map((item) => ({
        playlistId: item.id.playlistId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
      }));
    } catch (error) {
      console.error("YouTube API playlist search error:", error);
      throw error;
    }
  }

  static async getPlaylistItems(playlistId, maxResults = 50) {
    try {
      const url = `${this.BASE_URL}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${this.API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      // Get video details for duration
      const videoIds = data.items
        .map((item) => item.snippet.resourceId.videoId)
        .join(",");
      const videoDetails = await this.getVideoDetails(videoIds);

      return data.items.map((item) => {
        const details = videoDetails.find(
          (detail) => detail.id === item.snippet.resourceId.videoId
        );
        return {
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          channel:
            item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.medium.url,
          duration: details
            ? this.formatDuration(details.contentDetails.duration)
            : "Unknown",
          publishedAt: item.snippet.publishedAt,
          description: item.snippet.description,
        };
      });
    } catch (error) {
      console.error("YouTube API playlist items error:", error);
      throw error;
    }
  }

  static async getChannelVideos(channelId, maxResults = 25) {
    try {
      const url = `${this.BASE_URL}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${this.API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      // Get video details including duration
      const videoIds = data.items.map((item) => item.id.videoId).join(",");
      const videoDetails = await this.getVideoDetails(videoIds);

      return data.items.map((item) => {
        const details = videoDetails.find(
          (detail) => detail.id === item.id.videoId
        );
        return {
          videoId: item.id.videoId,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.medium.url,
          duration: details
            ? this.formatDuration(details.contentDetails.duration)
            : "Unknown",
          publishedAt: item.snippet.publishedAt,
          description: item.snippet.description,
        };
      });
    } catch (error) {
      console.error("YouTube API channel videos error:", error);
      throw error;
    }
  }

  static async getPopularVideos(regionCode = "US", maxResults = 25) {
    try {
      const url = `${this.BASE_URL}/videos?part=snippet,contentDetails&chart=mostPopular&regionCode=${regionCode}&maxResults=${maxResults}&key=${this.API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      return data.items.map((item) => ({
        videoId: item.id,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
        duration: this.formatDuration(item.contentDetails.duration),
        publishedAt: item.snippet.publishedAt,
        description: item.snippet.description,
      }));
    } catch (error) {
      console.error("YouTube API popular videos error:", error);
      throw error;
    }
  }

  static async searchByCategory(
    categoryId,
    regionCode = "US",
    maxResults = 25
  ) {
    try {
      const url = `${this.BASE_URL}/videos?part=snippet,contentDetails&chart=mostPopular&videoCategoryId=${categoryId}&regionCode=${regionCode}&maxResults=${maxResults}&key=${this.API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      return data.items.map((item) => ({
        videoId: item.id,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
        duration: this.formatDuration(item.contentDetails.duration),
        publishedAt: item.snippet.publishedAt,
        description: item.snippet.description,
      }));
    } catch (error) {
      console.error("YouTube API category search error:", error);
      throw error;
    }
  }

  // Helper method to check if API key is configured
  static isConfigured() {
    return this.API_KEY && this.API_KEY !== "YOUR_YOUTUBE_API_KEY_HERE";
  }

  // Mock data for testing when API key is not configured
  static getMockData() {
    return [
      {
        videoId: "dQw4w9WgXcQ",
        title: "Rick Astley - Never Gonna Give You Up",
        channel: "Rick Astley",
        thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
        duration: "3:33",
        publishedAt: "2009-10-25T06:57:33Z",
        description: 'The official video for "Never Gonna Give You Up"',
      },
      {
        videoId: "J---aiyznGQ",
        title: "Keyboard Cat",
        channel: "Keyboard Cat",
        thumbnail: "https://img.youtube.com/vi/J---aiyznGQ/mqdefault.jpg",
        duration: "0:54",
        publishedAt: "2009-06-07T00:23:03Z",
        description: "The original keyboard cat video",
      },
      {
        videoId: "kffacxfA7G4",
        title: "Baby Shark Dance",
        channel: "Pinkfong! Kids' Songs & Stories",
        thumbnail: "https://img.youtube.com/vi/kffacxfA7G4/mqdefault.jpg",
        duration: "2:17",
        publishedAt: "2016-06-17T08:00:31Z",
        description: "Sing and dance along with Baby Shark",
      },
    ];
  }
}

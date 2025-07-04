// WebSocket Manager for real-time synchronization
class WebSocketManager {
  constructor() {
      this.socket = null;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000;
      this.isConnected = false;
      this.messageQueue = [];
      
      // Event callbacks
      this.onMessage = null;
      this.onConnect = null;
      this.onDisconnect = null;
      this.onError = null;
      
      this.connect();
  }

  connect() {
      try {
          // Use WebSocket server URL - adjust based on your server setup
          const wsUrl = `ws://${window.location.hostname}:8080`;
          this.socket = new WebSocket(wsUrl);
          
          this.socket.onopen = (event) => {
              this.handleOpen(event);
          };
          
          this.socket.onmessage = (event) => {
              this.handleMessage(event);
          };
          
          this.socket.onclose = (event) => {
              this.handleClose(event);
          };
          
          this.socket.onerror = (event) => {
              this.handleError(event);
          };
          
      } catch (error) {
          console.error('WebSocket connection error:', error);
          this.scheduleReconnect();
      }
  }

  handleOpen(event) {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Send any queued messages
      this.flushMessageQueue();
      
      if (this.onConnect) {
          this.onConnect(event);
      }
  }

  handleMessage(event) {
      try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          if (this.onMessage) {
              this.onMessage(data);
          }
      } catch (error) {
          console.error('Error parsing WebSocket message:', error);
      }
  }

  handleClose(event) {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.isConnected = false;
      
      if (this.onDisconnect) {
          this.onDisconnect(event);
      }
      
      // Attempt to reconnect unless it was a deliberate close
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
      }
  }

  handleError(event) {
      console.error('WebSocket error:', event);
      
      if (this.onError) {
          this.onError(event);
      }
  }

  send(data) {
      if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
          try {
              this.socket.send(JSON.stringify(data));
              console.log('WebSocket message sent:', data);
          } catch (error) {
              console.error('Error sending WebSocket message:', error);
              this.queueMessage(data);
          }
      } else {
          console.log('WebSocket not connected, queuing message:', data);
          this.queueMessage(data);
      }
  }

  queueMessage(data) {
      this.messageQueue.push(data);
      // Limit queue size to prevent memory issues
      if (this.messageQueue.length > 100) {
          this.messageQueue.shift();
      }
  }

  flushMessageQueue() {
      if (this.messageQueue.length > 0) {
          console.log(`Sending ${this.messageQueue.length} queued messages`);
          
          while (this.messageQueue.length > 0) {
              const message = this.messageQueue.shift();
              this.sen
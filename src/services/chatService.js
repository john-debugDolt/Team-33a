/**
 * Live Chat Service
 *
 * API Base: http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com
 *
 * Endpoints:
 * - POST /api/chat/sessions - Start new chat session
 * - GET /api/chat/sessions/{sessionId} - Get session details
 * - GET /api/chat/sessions/{sessionId}/messages - Get messages
 * - POST /api/chat/sessions/{sessionId}/messages - Send message
 * - POST /api/chat/sessions/{sessionId}/close - Close session
 * - POST /api/chat/sessions/{sessionId}/rate?rating=X&feedback=Y - Rate session
 * - GET /api/chat/my-sessions?accountId=X - User chat history
 * - POST /api/chat/sessions/{sessionId}/read?senderType=X - Mark messages as read
 * - WebSocket: ws://BASE_URL/ws/chat/{sessionId}
 */

import { chatStorageService } from './chatStorageService';

// Use relative URLs for proxy support (Vite dev server or Vercel production)
const CHAT_API_BASE = '';  // Empty = relative URL, proxied through Vite/Vercel
const CHAT_WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

class ChatService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.sessionId = null;
    this.accountId = null;
    this.pollInterval = null;
    this.lastMessageTime = null;
  }

  // Subscribe to chat events
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  notify(event) {
    this.listeners.forEach(callback => callback(event));
  }

  /**
   * Start a new chat session
   * POST /api/chat/sessions
   * Body: { accountId: string, subject?: string }
   */
  async startSession(accountId, subject = null, userName = null) {
    this.accountId = accountId;
    this.userName = userName;

    try {
      console.log('Starting chat session for account:', accountId);

      const body = { accountId };
      if (subject) {
        body.subject = subject;
      }

      const response = await fetch(`${CHAT_API_BASE}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('Chat API response status:', response.status);
      const data = await response.json();
      console.log('Chat API response data:', data);

      if (response.ok && data.sessionId) {
        this.sessionId = data.sessionId;

        // Save session to local storage for admin panel visibility
        chatStorageService.saveSession({
          sessionId: data.sessionId,
          accountId: data.accountId || accountId,
          userName: userName, // Store user's display name for admin panel
          agentId: data.agentId,
          status: data.status || 'WAITING',
          subject: data.subject || subject,
          createdAt: data.createdAt,
        });

        return {
          success: true,
          sessionId: data.sessionId,
          accountId: data.accountId,
          agentId: data.agentId,
          status: data.status, // WAITING, ACTIVE, CLOSED
          subject: data.subject,
          createdAt: data.createdAt,
          unreadCount: data.unreadCount,
          ...data,
        };
      }

      return {
        success: false,
        error: data.message || data.error || 'Failed to start chat session',
      };
    } catch (error) {
      console.error('Start session error:', error);
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        return {
          success: false,
          error: 'Unable to connect to chat server. Please check your connection.',
        };
      }
      return {
        success: false,
        error: 'Failed to connect to chat server: ' + error.message,
      };
    }
  }

  /**
   * Connect WebSocket for real-time messaging
   * ws://BASE_URL/ws/chat/{sessionId}
   */
  connectWebSocket(sessionId) {
    return new Promise((resolve, reject) => {
      if (!sessionId) {
        reject(new Error('No session ID'));
        return;
      }

      try {
        const wsUrl = `${CHAT_WS_BASE}/ws/chat/${sessionId}`;
        console.log('Connecting WebSocket to:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notify({ type: 'connected' });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);
            this.handleWebSocketMessage(data);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnected = false;
          this.notify({ type: 'disconnected' });
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        // Connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  // Handle WebSocket messages - matches API response format
  handleWebSocketMessage(data) {
    // Message format from API:
    // { messageId, sessionId, senderType: 'USER'|'AGENT'|'SYSTEM', senderId, content, messageType, createdAt, read }
    if (data.messageId || data.content) {
      this.notify({
        type: 'message',
        message: {
          id: data.messageId,
          sessionId: data.sessionId,
          senderType: data.senderType, // USER, AGENT, SYSTEM
          senderId: data.senderId,
          content: data.content,
          messageType: data.messageType, // TEXT, IMAGE, FILE, SYSTEM_NOTIFICATION
          createdAt: data.createdAt,
          read: data.read,
        }
      });
    } else if (data.type === 'typing') {
      this.notify({ type: 'typing', isTyping: data.isTyping !== false });
    } else if (data.type === 'session_closed' || data.status === 'CLOSED') {
      this.notify({ type: 'chat_ended' });
    } else if (data.agentId && !data.messageId) {
      // Agent assigned notification
      this.notify({
        type: 'agent_join',
        agent: {
          id: data.agentId,
          name: data.agentName || 'Support Agent',
        }
      });
    }
  }

  // Attempt to reconnect WebSocket
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.sessionId) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => {
        this.connectWebSocket(this.sessionId).catch(console.error);
      }, delay);
    } else {
      this.notify({ type: 'connection_failed' });
    }
  }

  /**
   * Get session details
   * GET /api/chat/sessions/{sessionId}
   */
  async getSession(sessionId = this.sessionId) {
    if (!sessionId) {
      return { success: false, error: 'No session ID' };
    }

    try {
      const response = await fetch(`${CHAT_API_BASE}/api/chat/sessions/${sessionId}`);

      if (response.status === 404) {
        return { success: false, error: 'Session not found' };
      }

      const data = await response.json();

      if (response.ok) {
        return { success: true, data };
      }
      return { success: false, error: data.message || 'Failed to get session' };
    } catch (error) {
      console.error('Get session error:', error);
      return { success: false, error: 'Failed to fetch session details' };
    }
  }

  /**
   * Get messages for a session
   * GET /api/chat/sessions/{sessionId}/messages
   * Returns array of messages
   */
  async getMessages(sessionId = this.sessionId) {
    if (!sessionId) {
      return { success: false, error: 'No session ID', messages: [] };
    }

    try {
      const response = await fetch(`${CHAT_API_BASE}/api/chat/sessions/${sessionId}/messages`);
      const data = await response.json();

      if (response.ok) {
        // API returns array directly
        const messages = Array.isArray(data) ? data : (data.messages || data.data || []);
        return {
          success: true,
          messages: messages,
        };
      }
      return { success: false, error: data.message || 'Failed to get messages', messages: [] };
    } catch (error) {
      console.error('Get messages error:', error);
      return { success: false, error: 'Failed to fetch messages', messages: [] };
    }
  }

  /**
   * Send a message
   * POST /api/chat/sessions/{sessionId}/messages
   * Body: { senderId: string, senderType: 'USER'|'AGENT', content: string, messageType?: string }
   */
  async sendMessage(content, sessionId = this.sessionId) {
    if (!sessionId) {
      return { success: false, error: 'No active session' };
    }

    const messageBody = {
      senderId: this.accountId,
      senderType: 'USER',
      content: content,
    };

    // Save message to local storage for admin panel
    chatStorageService.saveMessage(sessionId, {
      senderId: this.accountId,
      senderType: 'USER',
      content: content,
      createdAt: new Date().toISOString(),
    });

    // Try WebSocket first if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(messageBody));
        return { success: true };
      } catch (e) {
        console.warn('WebSocket send failed, using REST:', e);
      }
    }

    // REST fallback
    try {
      const response = await fetch(`${CHAT_API_BASE}/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageBody),
      });

      const data = await response.json();

      if (response.ok || response.status === 201) {
        return {
          success: true,
          messageId: data.messageId,
          message: data,
        };
      }
      return { success: false, error: data.message || 'Failed to send message' };
    } catch (error) {
      console.error('Send message error:', error);
      return { success: false, error: 'Failed to send message' };
    }
  }

  /**
   * Close a chat session
   * POST /api/chat/sessions/{sessionId}/close
   */
  async closeSession(sessionId = this.sessionId) {
    if (!sessionId) {
      return { success: false, error: 'No session ID' };
    }

    // Update session status in local storage
    chatStorageService.updateSessionStatus(sessionId, 'CLOSED');

    try {
      const response = await fetch(`${CHAT_API_BASE}/api/chat/sessions/${sessionId}/close`, {
        method: 'POST',
      });

      const data = await response.json();

      // Disconnect WebSocket
      this.disconnect();

      if (response.ok) {
        return { success: true, data };
      }
      return { success: false, error: data.message || 'Failed to close session' };
    } catch (error) {
      console.error('Close session error:', error);
      this.disconnect();
      return { success: false, error: 'Failed to close session' };
    }
  }

  /**
   * Rate a chat session
   * POST /api/chat/sessions/{sessionId}/rate?rating=X&feedback=Y
   * Uses query parameters, NOT JSON body
   */
  async rateSession(rating, feedback = '', sessionId = this.sessionId) {
    if (!sessionId) {
      return { success: false, error: 'No session ID' };
    }

    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' };
    }

    try {
      let url = `${CHAT_API_BASE}/api/chat/sessions/${sessionId}/rate?rating=${rating}`;
      if (feedback) {
        url += `&feedback=${encodeURIComponent(feedback)}`;
      }

      const response = await fetch(url, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, data };
      }
      return { success: false, error: data.message || 'Failed to rate session' };
    } catch (error) {
      console.error('Rate session error:', error);
      return { success: false, error: 'Failed to rate session' };
    }
  }

  /**
   * Mark messages as read
   * POST /api/chat/sessions/{sessionId}/read?senderType=AGENT
   */
  async markAsRead(senderType = 'AGENT', sessionId = this.sessionId) {
    if (!sessionId) {
      return { success: false, error: 'No session ID' };
    }

    try {
      const response = await fetch(
        `${CHAT_API_BASE}/api/chat/sessions/${sessionId}/read?senderType=${senderType}`,
        { method: 'POST' }
      );

      if (response.ok) {
        return { success: true };
      }
      return { success: false, error: 'Failed to mark messages as read' };
    } catch (error) {
      console.error('Mark as read error:', error);
      return { success: false, error: 'Failed to mark messages as read' };
    }
  }

  /**
   * Get user's chat history
   * GET /api/chat/my-sessions?accountId=X
   */
  async getChatHistory(accountId = this.accountId) {
    if (!accountId) {
      return { success: false, error: 'No account ID', sessions: [] };
    }

    try {
      const response = await fetch(`${CHAT_API_BASE}/api/chat/my-sessions?accountId=${accountId}`);
      const data = await response.json();

      if (response.ok) {
        // API returns array directly
        const sessions = Array.isArray(data) ? data : (data.sessions || data.data || []);
        return {
          success: true,
          sessions: sessions,
        };
      }
      return { success: false, error: data.message || 'Failed to get chat history', sessions: [] };
    } catch (error) {
      console.error('Get chat history error:', error);
      return { success: false, error: 'Failed to fetch chat history', sessions: [] };
    }
  }

  /**
   * Start polling for messages (fallback when WebSocket fails)
   */
  startPolling(intervalMs = 3000) {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    console.log('Starting message polling...');

    this.pollInterval = setInterval(async () => {
      if (!this.sessionId) return;

      const result = await this.getMessages(this.sessionId);
      if (result.success && result.messages?.length > 0) {
        result.messages.forEach(msg => {
          const msgTime = new Date(msg.createdAt).getTime();
          // Only process new messages
          if (!this.lastMessageTime || msgTime > this.lastMessageTime) {
            // Don't notify for our own messages
            if (msg.senderType !== 'USER') {
              this.notify({
                type: 'message',
                message: {
                  id: msg.messageId,
                  sessionId: msg.sessionId,
                  senderType: msg.senderType,
                  senderId: msg.senderId,
                  content: msg.content,
                  messageType: msg.messageType,
                  createdAt: msg.createdAt,
                  read: msg.read,
                }
              });
            }
            this.lastMessageTime = msgTime;
          }
        });
      }

      // Also check session status
      const sessionResult = await this.getSession(this.sessionId);
      if (sessionResult.success) {
        if (sessionResult.data.status === 'CLOSED') {
          this.notify({ type: 'chat_ended' });
          this.stopPolling();
        } else if (sessionResult.data.agentId && sessionResult.data.status === 'ACTIVE') {
          // Agent joined
          this.notify({
            type: 'agent_join',
            agent: { id: sessionResult.data.agentId }
          });
        }
      }
    }, intervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Connect to chat - starts session and WebSocket
   */
  async connect(accountId, subject = null, userName = null) {
    this.accountId = accountId;
    this.userName = userName;

    // Start a new session
    const sessionResult = await this.startSession(accountId, subject, userName);
    if (!sessionResult.success) {
      return sessionResult;
    }

    // Try to connect WebSocket
    try {
      await this.connectWebSocket(sessionResult.sessionId);
    } catch (error) {
      console.warn('WebSocket failed, using polling:', error);
      // Fallback to polling
      this.isConnected = true;
      this.notify({ type: 'connected', mode: 'polling' });
      this.startPolling();
    }

    return sessionResult;
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId, accountId) {
    this.sessionId = sessionId;
    this.accountId = accountId;

    // Get session details
    const sessionResult = await this.getSession(sessionId);
    if (!sessionResult.success) {
      return sessionResult;
    }

    // Check if session is still active
    if (sessionResult.data.status === 'CLOSED') {
      return { success: false, error: 'Session is already closed' };
    }

    // Try to connect WebSocket
    try {
      await this.connectWebSocket(sessionId);
    } catch (error) {
      console.warn('WebSocket failed, using polling:', error);
      this.isConnected = true;
      this.notify({ type: 'connected', mode: 'polling' });
      this.startPolling();
    }

    return { success: true, ...sessionResult.data };
  }

  /**
   * Disconnect from chat
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopPolling();
    this.isConnected = false;
    this.sessionId = null;
    this.lastMessageTime = null;
  }

  /**
   * Send typing indicator via WebSocket
   */
  sendTypingIndicator(isTyping) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'typing',
        isTyping,
        senderId: this.accountId,
        senderType: 'USER',
      }));
    }
  }

  // Getters
  getSessionId() {
    return this.sessionId;
  }

  getAccountId() {
    return this.accountId;
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

// Singleton instance
export const chatService = new ChatService();

export default chatService;

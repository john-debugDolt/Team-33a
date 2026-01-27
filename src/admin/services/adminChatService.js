/**
 * Admin Chat Service
 * Handles chat functionality for admin/agent panel
 *
 * API Endpoints:
 * - GET /api/chat/sessions - Get all chat sessions (admin)
 * - GET /api/chat/sessions/{sessionId} - Get session details
 * - GET /api/chat/sessions/{sessionId}/messages - Get messages
 * - POST /api/chat/sessions/{sessionId}/messages - Send message as AGENT
 * - POST /api/chat/sessions/{sessionId}/close - Close session
 * - POST /api/chat/sessions/{sessionId}/read?senderType=USER - Mark user messages as read
 *
 * Chat history is fetched from the backend API and persists until manually deleted
 */

import { chatStorageService } from '../../services/chatStorageService';

const CHAT_API_BASE = '';
const BACKEND_HOST = 'k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';
// WebSocket: use wss:// for secure connections
const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
const CHAT_WS_BASE = isSecure ? `wss://${BACKEND_HOST}` : `ws://${BACKEND_HOST}`;

class AdminChatService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.isConnected = false;
    this.currentSessionId = null;
    this.agentId = null;
    this.pollInterval = null;
    this.sessionsPolling = null;
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
   * Get all chat sessions for admin
   * Fetches from backend API - all sessions persist until manually deleted
   */
  async getAllSessions(status = null) {
    try {
      // Fetch from backend API
      const url = status
        ? `${CHAT_API_BASE}/api/chat/sessions?status=${status}`
        : `${CHAT_API_BASE}/api/chat/sessions`;

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        const sessions = Array.isArray(data) ? data : (data.sessions || data.data || []);

        // Enrich with local data for userName display
        const enrichedSessions = sessions.map(session => {
          const localSession = chatStorageService.getSession(session.sessionId);
          return {
            ...session,
            userName: localSession?.userName || session.userName || session.accountId,
          };
        });

        // Cache sessions locally for offline access
        enrichedSessions.forEach(session => {
          chatStorageService.saveSession(session);
        });

        return {
          success: true,
          sessions: enrichedSessions,
          source: 'api',
        };
      }

      // If API fails, try localStorage cache
      console.log('API returned error, using cached data');
      const sessions = chatStorageService.getSessionsByStatus(status);
      return {
        success: true,
        sessions: sessions,
        source: 'cache',
      };
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      // Use cached data on network error
      const sessions = chatStorageService.getSessionsByStatus(status);
      return {
        success: sessions.length > 0,
        sessions: sessions,
        source: 'cache',
        error: sessions.length === 0 ? 'Unable to connect to chat server' : null,
      };
    }
  }

  /**
   * Get waiting sessions (unassigned)
   */
  async getWaitingSessions() {
    return this.getAllSessions('WAITING');
  }

  /**
   * Get active sessions
   */
  async getActiveSessions() {
    return this.getAllSessions('ACTIVE');
  }

  /**
   * Get session details
   * GET /api/chat/sessions/{sessionId}
   */
  async getSession(sessionId) {
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
   * Falls back to localStorage if API fails
   */
  async getMessages(sessionId) {
    if (!sessionId) {
      return { success: false, error: 'No session ID', messages: [] };
    }

    try {
      const response = await fetch(`${CHAT_API_BASE}/api/chat/sessions/${sessionId}/messages`);
      const data = await response.json();

      if (response.ok) {
        const messages = Array.isArray(data) ? data : (data.messages || data.data || []);
        return {
          success: true,
          messages: messages,
        };
      }
      // Fallback to localStorage
      const localMessages = chatStorageService.getMessages(sessionId);
      return { success: true, messages: localMessages };
    } catch (error) {
      console.error('Get messages error:', error);
      // Fallback to localStorage
      const localMessages = chatStorageService.getMessages(sessionId);
      return { success: true, messages: localMessages };
    }
  }

  /**
   * Send a message as agent
   * POST /api/chat/sessions/{sessionId}/messages
   */
  async sendMessage(content, sessionId, agentId = 'admin') {
    if (!sessionId) {
      return { success: false, error: 'No session ID' };
    }

    const messageBody = {
      senderId: agentId,
      senderType: 'AGENT',
      content: content,
    };

    // Save agent message to localStorage
    chatStorageService.saveMessage(sessionId, {
      senderId: agentId,
      senderType: 'AGENT',
      content: content,
      createdAt: new Date().toISOString(),
    });

    // Update session status to ACTIVE when agent responds
    chatStorageService.updateSessionStatus(sessionId, 'ACTIVE');

    // Try WebSocket first if connected to this session
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentSessionId === sessionId) {
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
   * Join a chat session (claim it as agent)
   * This might be a custom endpoint or just connecting to WebSocket
   */
  async joinSession(sessionId, agentId = 'admin') {
    this.currentSessionId = sessionId;
    this.agentId = agentId;

    // Try to connect WebSocket
    try {
      await this.connectWebSocket(sessionId);
      return { success: true };
    } catch (error) {
      console.warn('WebSocket failed, using polling:', error);
      this.startPolling(sessionId);
      return { success: true, mode: 'polling' };
    }
  }

  /**
   * Connect WebSocket for real-time messaging
   */
  connectWebSocket(sessionId) {
    return new Promise((resolve, reject) => {
      if (!sessionId) {
        reject(new Error('No session ID'));
        return;
      }

      // Close existing connection
      if (this.ws) {
        this.ws.close();
      }

      try {
        const wsUrl = `${CHAT_WS_BASE}/ws/chat/${sessionId}`;
        console.log('Admin connecting WebSocket to:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Admin WebSocket connected');
          this.isConnected = true;
          this.notify({ type: 'connected' });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Admin WebSocket message:', data);
            this.handleWebSocketMessage(data);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.ws.onclose = () => {
          console.log('Admin WebSocket disconnected');
          this.isConnected = false;
          this.notify({ type: 'disconnected' });
        };

        this.ws.onerror = (error) => {
          console.error('Admin WebSocket error:', error);
          reject(error);
        };

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

  // Handle WebSocket messages
  handleWebSocketMessage(data) {
    if (data.messageId || data.content) {
      this.notify({
        type: 'message',
        message: {
          id: data.messageId,
          sessionId: data.sessionId,
          senderType: data.senderType,
          senderId: data.senderId,
          content: data.content,
          messageType: data.messageType,
          createdAt: data.createdAt,
          read: data.read,
        }
      });
    } else if (data.type === 'typing') {
      this.notify({ type: 'typing', isTyping: data.isTyping !== false, senderId: data.senderId });
    } else if (data.type === 'session_closed' || data.status === 'CLOSED') {
      this.notify({ type: 'session_closed' });
    }
  }

  /**
   * Start polling for messages
   */
  startPolling(sessionId, intervalMs = 3000) {
    this.stopPolling();

    let lastMessageTime = null;

    this.pollInterval = setInterval(async () => {
      const result = await this.getMessages(sessionId);
      if (result.success && result.messages?.length > 0) {
        result.messages.forEach(msg => {
          const msgTime = new Date(msg.createdAt).getTime();
          if (!lastMessageTime || msgTime > lastMessageTime) {
            if (msg.senderType === 'USER') {
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
            lastMessageTime = msgTime;
          }
        });
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
   * Start polling for new sessions (for chat list)
   */
  startSessionsPolling(callback, intervalMs = 5000) {
    this.stopSessionsPolling();

    // Initial fetch
    this.getAllSessions().then(callback);

    this.sessionsPolling = setInterval(async () => {
      const result = await this.getAllSessions();
      callback(result);
    }, intervalMs);
  }

  /**
   * Stop sessions polling
   */
  stopSessionsPolling() {
    if (this.sessionsPolling) {
      clearInterval(this.sessionsPolling);
      this.sessionsPolling = null;
    }
  }

  /**
   * Close a chat session
   */
  async closeSession(sessionId) {
    if (!sessionId) {
      return { success: false, error: 'No session ID' };
    }

    // Update localStorage
    chatStorageService.updateSessionStatus(sessionId, 'CLOSED');

    try {
      const response = await fetch(`${CHAT_API_BASE}/api/chat/sessions/${sessionId}/close`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, data };
      }
      return { success: true }; // Still return success since localStorage was updated
    } catch (error) {
      console.error('Close session error:', error);
      return { success: true }; // Still return success since localStorage was updated
    }
  }

  /**
   * Mark user messages as read
   */
  async markAsRead(sessionId) {
    if (!sessionId) {
      return { success: false, error: 'No session ID' };
    }

    // Update localStorage
    chatStorageService.markSessionAsRead(sessionId);

    try {
      const response = await fetch(
        `${CHAT_API_BASE}/api/chat/sessions/${sessionId}/read?senderType=USER`,
        { method: 'POST' }
      );

      if (response.ok) {
        return { success: true };
      }
      return { success: true }; // Still return success since localStorage was updated
    } catch (error) {
      console.error('Mark as read error:', error);
      return { success: true }; // Still return success since localStorage was updated
    }
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(isTyping) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'typing',
        isTyping,
        senderId: this.agentId,
        senderType: 'AGENT',
      }));
    }
  }

  /**
   * Disconnect from current session
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopPolling();
    this.isConnected = false;
    this.currentSessionId = null;
  }

  /**
   * Clean up all connections
   */
  cleanup() {
    this.disconnect();
    this.stopSessionsPolling();
  }
}

// Singleton instance
export const adminChatService = new AdminChatService();

export default adminChatService;

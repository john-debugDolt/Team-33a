/**
 * Chat Service - Live chat with support
 * Public API - No authentication required for user endpoints
 *
 * Endpoints:
 * - POST /api/chat/sessions - Start new session
 * - GET /api/chat/sessions/{sessionId} - Get session
 * - GET /api/chat/sessions/{sessionId}/messages - Get messages
 * - POST /api/chat/sessions/{sessionId}/messages - Send message
 * - POST /api/chat/sessions/{sessionId}/close - Close session
 * - POST /api/chat/sessions/{sessionId}/rate - Rate session
 * - GET /api/chat/my-sessions - Get user's sessions
 */

// API base - call accounts.team33.mx directly
const API_BASE = 'https://accounts.team33.mx';
const BACKEND_HOST = 'accounts.team33.mx';
const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';

class ChatService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.isConnected = false;
    this.sessionId = null;
    this.accountId = null;
    this.pollInterval = null;
    this.seenMessageIds = new Set(); // Track messages already shown to user
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event) {
    this.listeners.forEach(callback => callback(event));
  }

  /**
   * Start a new chat session
   * POST /api/chat/sessions
   */
  async startSession(accountId, subject = null) {
    this.accountId = accountId;

    try {
      const body = { accountId };
      if (subject) body.subject = subject;

      const response = await fetch(`${API_BASE}/api/chat/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data.sessionId) {
        this.sessionId = data.sessionId;
        return {
          success: true,
          sessionId: data.sessionId,
          status: data.status,
          subject: data.subject,
        };
      }

      return {
        success: false,
        error: data.message || 'Failed to start chat',
      };
    } catch (error) {
      console.error('[ChatService] Start session error:', error);
      return { success: false, error: 'Failed to connect to chat' };
    }
  }

  /**
   * Get session details
   * GET /api/chat/sessions/{sessionId}
   */
  async getSession(sessionId = this.sessionId) {
    if (!sessionId) return { success: false, error: 'No session ID' };

    try {
      const response = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}`);
      const data = await response.json();

      if (response.ok) {
        return { success: true, session: data };
      }

      return { success: false, error: 'Session not found' };
    } catch (error) {
      console.error('[ChatService] Get session error:', error);
      return { success: false, error: 'Failed to fetch session' };
    }
  }

  /**
   * Get messages
   * GET /api/chat/sessions/{sessionId}/messages
   */
  async getMessages(sessionId = this.sessionId) {
    if (!sessionId) return { success: false, messages: [] };

    try {
      const response = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/messages`);
      const data = await response.json();

      if (response.ok) {
        const messages = Array.isArray(data) ? data : (data.messages || []);
        return { success: true, messages };
      }

      return { success: false, messages: [] };
    } catch (error) {
      console.error('[ChatService] Get messages error:', error);
      return { success: false, messages: [] };
    }
  }

  /**
   * Send a message
   * POST /api/chat/sessions/{sessionId}/messages
   */
  async sendMessage(content, sessionId = this.sessionId) {
    if (!sessionId) return { success: false, error: 'No active session' };

    try {
      const response = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: this.accountId,
          senderType: 'USER',
          content,
        }),
      });

      const data = await response.json();

      if (response.ok || response.status === 201) {
        return { success: true, messageId: data.messageId };
      }

      return { success: false, error: 'Failed to send message' };
    } catch (error) {
      console.error('[ChatService] Send message error:', error);
      return { success: false, error: 'Failed to send message' };
    }
  }

  /**
   * Close session
   * POST /api/chat/sessions/{sessionId}/close
   */
  async closeSession(sessionId = this.sessionId) {
    if (!sessionId) return { success: false };

    try {
      const response = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/close`, {
        method: 'POST',
      });

      this.disconnect();
      return { success: response.ok };
    } catch (error) {
      console.error('[ChatService] Close session error:', error);
      this.disconnect();
      return { success: false };
    }
  }

  /**
   * Rate session
   * POST /api/chat/sessions/{sessionId}/rate?rating=X&feedback=Y
   */
  async rateSession(rating, feedback = '', sessionId = this.sessionId) {
    if (!sessionId) return { success: false };

    try {
      let url = `${API_BASE}/api/chat/sessions/${sessionId}/rate?rating=${rating}`;
      if (feedback) url += `&feedback=${encodeURIComponent(feedback)}`;

      const response = await fetch(url, { method: 'POST' });
      return { success: response.ok };
    } catch (error) {
      console.error('[ChatService] Rate session error:', error);
      return { success: false };
    }
  }

  /**
   * Get user's chat history
   * GET /api/chat/my-sessions?accountId=X
   */
  async getChatHistory(accountId = this.accountId) {
    if (!accountId) return { success: false, sessions: [] };

    try {
      const response = await fetch(`${API_BASE}/api/chat/my-sessions?accountId=${accountId}`);
      const data = await response.json();

      if (response.ok) {
        const sessions = Array.isArray(data) ? data : (data.sessions || []);
        return { success: true, sessions };
      }

      return { success: false, sessions: [] };
    } catch (error) {
      console.error('[ChatService] Get history error:', error);
      return { success: false, sessions: [] };
    }
  }

  /**
   * Connect to chat (start session + polling)
   */
  async connect(accountId, subject = null) {
    const result = await this.startSession(accountId, subject);
    if (result.success) {
      this.startPolling();
      this.notify({ type: 'connected' });
    }
    return result;
  }

  /**
   * Start polling for messages
   */
  startPolling(intervalMs = 3000) {
    this.stopPolling();
    this.isConnected = true;

    this.pollInterval = setInterval(async () => {
      if (!this.sessionId) return;

      const result = await this.getMessages();
      if (result.success) {
        result.messages.forEach(msg => {
          // Create a unique ID for the message
          const messageId = msg.messageId || msg.id || `${msg.createdAt}-${msg.content}`;

          // Only notify for messages we haven't seen yet and are not from current user
          if (msg.senderType !== 'USER' && !this.seenMessageIds.has(messageId)) {
            this.seenMessageIds.add(messageId);
            this.notify({ type: 'message', message: msg });
          }
        });
      }

      const sessionResult = await this.getSession();
      if (sessionResult.success && sessionResult.session.status === 'CLOSED') {
        this.notify({ type: 'chat_ended' });
        this.stopPolling();
      }
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  disconnect() {
    this.stopPolling();
    this.isConnected = false;
    this.sessionId = null;
  }

  getSessionId() {
    return this.sessionId;
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export const chatService = new ChatService();
export default chatService;

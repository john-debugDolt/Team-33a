/**
 * Chat Storage Service
 * Stores chat sessions in localStorage for admin panel visibility
 * This is a workaround until backend adds GET /api/chat/sessions endpoint
 */

const CHAT_SESSIONS_KEY = 'team33_chat_sessions';
const CHAT_MESSAGES_KEY = 'team33_chat_messages';

class ChatStorageService {
  // Get all stored sessions
  getSessions() {
    try {
      const sessions = JSON.parse(localStorage.getItem(CHAT_SESSIONS_KEY) || '[]');
      // Sort by most recent first
      return sessions.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    } catch {
      return [];
    }
  }

  // Get sessions by status
  getSessionsByStatus(status) {
    const sessions = this.getSessions();
    if (!status || status === 'ALL') return sessions;
    return sessions.filter(s => s.status === status);
  }

  // Get a single session
  getSession(sessionId) {
    const sessions = this.getSessions();
    return sessions.find(s => s.sessionId === sessionId);
  }

  // Save or update a session
  saveSession(session) {
    if (!session || !session.sessionId) return;

    const sessions = this.getSessions();
    const existingIndex = sessions.findIndex(s => s.sessionId === session.sessionId);

    const sessionData = {
      sessionId: session.sessionId,
      accountId: session.accountId,
      userName: session.userName || null, // Store user's display name
      agentId: session.agentId || null,
      status: session.status || 'WAITING',
      subject: session.subject || 'Support Request',
      createdAt: session.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessage: session.lastMessage || null,
      lastMessageAt: session.lastMessageAt || null,
      unreadCount: session.unreadCount || 0,
    };

    if (existingIndex >= 0) {
      // Update existing session
      sessions[existingIndex] = { ...sessions[existingIndex], ...sessionData };
    } else {
      // Add new session
      sessions.unshift(sessionData);
    }

    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    return sessionData;
  }

  // Update session status
  updateSessionStatus(sessionId, status) {
    const sessions = this.getSessions();
    const session = sessions.find(s => s.sessionId === sessionId);
    if (session) {
      session.status = status;
      session.updatedAt = new Date().toISOString();
      if (status === 'CLOSED') {
        session.closedAt = new Date().toISOString();
      }
      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    }
    return session;
  }

  // Update last message for session
  updateLastMessage(sessionId, message, senderType) {
    const sessions = this.getSessions();
    const session = sessions.find(s => s.sessionId === sessionId);
    if (session) {
      session.lastMessage = message;
      session.lastMessageAt = new Date().toISOString();
      session.updatedAt = new Date().toISOString();
      // Increment unread count for admin if message from user
      if (senderType === 'USER') {
        session.unreadCount = (session.unreadCount || 0) + 1;
      }
      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    }
    return session;
  }

  // Mark session as read (reset unread count)
  markSessionAsRead(sessionId) {
    const sessions = this.getSessions();
    const session = sessions.find(s => s.sessionId === sessionId);
    if (session) {
      session.unreadCount = 0;
      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    }
    return session;
  }

  // Store messages for a session
  saveMessage(sessionId, message) {
    if (!sessionId || !message) return;

    const allMessages = this.getAllMessages();
    const sessionMessages = allMessages[sessionId] || [];

    const messageData = {
      messageId: message.messageId || message.id || Date.now().toString(),
      sessionId: sessionId,
      senderId: message.senderId,
      senderType: message.senderType,
      content: message.content,
      messageType: message.messageType || 'TEXT',
      createdAt: message.createdAt || new Date().toISOString(),
      read: message.read || false,
    };

    // Avoid duplicates
    if (!sessionMessages.find(m => m.messageId === messageData.messageId)) {
      sessionMessages.push(messageData);
      allMessages[sessionId] = sessionMessages;
      localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(allMessages));
    }

    // Update session's last message
    this.updateLastMessage(sessionId, messageData.content, messageData.senderType);

    return messageData;
  }

  // Get messages for a session
  getMessages(sessionId) {
    const allMessages = this.getAllMessages();
    return allMessages[sessionId] || [];
  }

  // Get all messages object
  getAllMessages() {
    try {
      return JSON.parse(localStorage.getItem(CHAT_MESSAGES_KEY) || '{}');
    } catch {
      return {};
    }
  }

  // Delete a session
  deleteSession(sessionId) {
    const sessions = this.getSessions();
    const filtered = sessions.filter(s => s.sessionId !== sessionId);
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(filtered));

    // Also delete messages
    const allMessages = this.getAllMessages();
    delete allMessages[sessionId];
    localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(allMessages));
  }

  // Clear all sessions (for testing)
  clearAll() {
    localStorage.removeItem(CHAT_SESSIONS_KEY);
    localStorage.removeItem(CHAT_MESSAGES_KEY);
  }

  // Get counts by status
  getCounts() {
    const sessions = this.getSessions();
    return {
      all: sessions.length,
      waiting: sessions.filter(s => s.status === 'WAITING').length,
      active: sessions.filter(s => s.status === 'ACTIVE').length,
      closed: sessions.filter(s => s.status === 'CLOSED').length,
    };
  }
}

export const chatStorageService = new ChatStorageService();
export default chatStorageService;

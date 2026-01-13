import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiSend,
  FiUser,
  FiX,
  FiClock,
  FiRefreshCw
} from 'react-icons/fi';
import { adminChatService } from '../services/adminChatService';
import { chatStorageService } from '../../services/chatStorageService';

const ChatView = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format date for message groups
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  // Fetch session and messages
  const fetchData = async () => {
    try {
      setError(null);

      // Get session details from API
      const sessionResult = await adminChatService.getSession(sessionId);
      // Also get local session data for userName
      const localSession = chatStorageService.getSession(sessionId);

      if (sessionResult.success) {
        // Merge API data with local data (for userName)
        setSession({
          ...sessionResult.data,
          userName: localSession?.userName || sessionResult.data?.userName
        });
      } else if (localSession) {
        // Fallback to local session if API fails
        setSession(localSession);
      }

      // Get messages
      const messagesResult = await adminChatService.getMessages(sessionId);
      if (messagesResult.success) {
        setMessages(messagesResult.messages);
        scrollToBottom();
      } else {
        setError(messagesResult.error);
      }
    } catch (err) {
      setError('Failed to load chat');
      console.error('Fetch chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle new message from WebSocket/polling
  const handleChatEvent = (event) => {
    if (event.type === 'message') {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.messageId === event.message.id)) {
          return prev;
        }
        return [...prev, {
          messageId: event.message.id,
          sessionId: event.message.sessionId,
          senderType: event.message.senderType,
          senderId: event.message.senderId,
          content: event.message.content,
          createdAt: event.message.createdAt,
        }];
      });
      scrollToBottom();
    } else if (event.type === 'typing') {
      if (event.senderId !== 'admin') {
        setIsTyping(event.isTyping);
      }
    } else if (event.type === 'session_closed') {
      setSession(prev => prev ? { ...prev, status: 'CLOSED' } : prev);
    }
  };

  // Setup
  useEffect(() => {
    fetchData();

    // Subscribe to events
    const unsubscribe = adminChatService.subscribe(handleChatEvent);

    // Join session for real-time updates
    adminChatService.joinSession(sessionId, 'admin');

    // Mark messages as read
    adminChatService.markAsRead(sessionId);

    return () => {
      unsubscribe();
      adminChatService.disconnect();
    };
  }, [sessionId]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send message
  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || sending) return;

    setSending(true);
    setNewMessage('');

    // Optimistically add message
    const tempMessage = {
      messageId: `temp-${Date.now()}`,
      sessionId,
      senderType: 'AGENT',
      senderId: 'admin',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    try {
      const result = await adminChatService.sendMessage(content, sessionId, 'admin');
      if (!result.success) {
        // Remove temp message on failure
        setMessages(prev => prev.filter(m => m.messageId !== tempMessage.messageId));
        setError('Failed to send message');
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.messageId !== tempMessage.messageId));
      setError('Failed to send message');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Close session
  const handleCloseSession = async () => {
    if (!confirm('Are you sure you want to close this chat session?')) return;

    try {
      const result = await adminChatService.closeSession(sessionId);
      if (result.success) {
        navigate('/chatlist');
      } else {
        setError('Failed to close session');
      }
    } catch (err) {
      setError('Failed to close session');
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'WAITING': return '#f59e0b';
      case 'ACTIVE': return '#22c55e';
      case 'CLOSED': return '#6b7280';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="chat-view-page">
        <div className="empty-state">
          <FiRefreshCw size={48} style={{ opacity: 0.3, animation: 'spin 1s linear infinite' }} />
          <p className="empty-state-text">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view-page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Chat Header */}
      <div className="chat-view-header" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '15px 20px',
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0
      }}>
        <button
          onClick={() => navigate('/chatlist')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginRight: '15px',
            padding: '5px'
          }}
        >
          <FiArrowLeft size={24} color="#374151" />
        </button>

        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '12px'
        }}>
          <FiUser size={18} color="#6b7280" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong>{session?.userName || session?.accountId || 'Unknown User'}</strong>
            {session?.status && (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: getStatusColor(session.status),
                color: '#fff'
              }}>
                {session.status}
              </span>
            )}
          </div>
          {session?.subject && (
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              {session.subject}
            </p>
          )}
        </div>

        {session?.status !== 'CLOSED' && (
          <button
            onClick={handleCloseSession}
            className="btn btn-sm"
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FiX size={14} />
            Close Chat
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '10px 20px',
          background: '#fee2e2',
          color: '#dc2626',
          fontSize: '14px',
          flexShrink: 0
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="chat-messages" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        background: '#f9fafb'
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px' }}>
            <p>No messages yet</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isAgent = msg.senderType === 'AGENT';
            const isSystem = msg.senderType === 'SYSTEM';
            const showDate = index === 0 ||
              formatDate(msg.createdAt) !== formatDate(messages[index - 1]?.createdAt);

            return (
              <div key={msg.messageId || index}>
                {/* Date Separator */}
                {showDate && (
                  <div style={{
                    textAlign: 'center',
                    margin: '20px 0',
                    color: '#9ca3af',
                    fontSize: '12px'
                  }}>
                    <span style={{
                      background: '#e5e7eb',
                      padding: '4px 12px',
                      borderRadius: '12px'
                    }}>
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                )}

                {/* System Message */}
                {isSystem ? (
                  <div style={{
                    textAlign: 'center',
                    margin: '10px 0',
                    color: '#6b7280',
                    fontSize: '13px',
                    fontStyle: 'italic'
                  }}>
                    {msg.content}
                  </div>
                ) : (
                  /* Regular Message */
                  <div style={{
                    display: 'flex',
                    justifyContent: isAgent ? 'flex-end' : 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      borderRadius: isAgent ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isAgent ? '#3b82f6' : '#fff',
                      color: isAgent ? '#fff' : '#374151',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                      </p>
                      <div style={{
                        fontSize: '11px',
                        color: isAgent ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                        marginTop: '4px',
                        textAlign: 'right',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '4px'
                      }}>
                        <FiClock size={10} />
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div style={{ display: 'flex', marginBottom: '12px' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '18px 18px 18px 4px',
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span className="typing-dot" style={{ width: '8px', height: '8px', background: '#9ca3af', borderRadius: '50%', animation: 'typing 1.4s infinite' }}></span>
                <span className="typing-dot" style={{ width: '8px', height: '8px', background: '#9ca3af', borderRadius: '50%', animation: 'typing 1.4s infinite 0.2s' }}></span>
                <span className="typing-dot" style={{ width: '8px', height: '8px', background: '#9ca3af', borderRadius: '50%', animation: 'typing 1.4s infinite 0.4s' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {session?.status !== 'CLOSED' ? (
        <div className="chat-input-area" style={{
          padding: '15px 20px',
          background: '#fff',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
          flexShrink: 0
        }}>
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            rows={1}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: '24px',
              resize: 'none',
              fontSize: '14px',
              outline: 'none',
              maxHeight: '120px',
              minHeight: '44px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: newMessage.trim() ? '#3b82f6' : '#e5e7eb',
              border: 'none',
              cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >
            <FiSend size={18} color={newMessage.trim() ? '#fff' : '#9ca3af'} />
          </button>
        </div>
      ) : (
        <div style={{
          padding: '20px',
          background: '#f3f4f6',
          textAlign: 'center',
          color: '#6b7280',
          borderTop: '1px solid #e5e7eb',
          flexShrink: 0
        }}>
          This chat session has been closed
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ChatView;

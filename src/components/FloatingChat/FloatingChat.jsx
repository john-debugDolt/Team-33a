import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import './FloatingChat.css';

// Storage keys for persisting chat data
const STORAGE_KEYS = {
  CHAT_OPEN: 'team33_chat_open',
  CHAT_SESSION: 'team33_chat_session',
  CHAT_MESSAGES: 'team33_chat_messages',
  CHAT_STARTED: 'team33_chat_started',
};

export default function FloatingChat() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [agent, setAgent] = useState(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedOpen = localStorage.getItem(STORAGE_KEYS.CHAT_OPEN) === 'true';
    const savedSession = localStorage.getItem(STORAGE_KEYS.CHAT_SESSION);
    const savedMessages = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
    const savedStarted = localStorage.getItem(STORAGE_KEYS.CHAT_STARTED) === 'true';

    if (savedOpen) setIsOpen(savedOpen);
    if (savedSession) setSessionId(savedSession);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // Convert time strings back to Date objects
        const messagesWithDates = parsed.map(msg => ({
          ...msg,
          time: new Date(msg.time)
        }));
        setMessages(messagesWithDates);
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    if (savedStarted) setChatStarted(savedStarted);

    // If there's a saved session and chat was started, reconnect
    if (savedSession && savedStarted && isAuthenticated) {
      reconnectSession(savedSession);
    }
  }, [isAuthenticated]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CHAT_OPEN, isOpen.toString());
  }, [isOpen]);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(STORAGE_KEYS.CHAT_SESSION, sessionId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CHAT_SESSION);
    }
  }, [sessionId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CHAT_STARTED, chatStarted.toString());
  }, [chatStarted]);

  // Reconnect to existing session
  const reconnectSession = async (savedSessionId) => {
    const accountId = user?.accountId || user?.id;
    if (!accountId) return;

    chatService.sessionId = savedSessionId;
    chatService.accountId = accountId;

    const sessionResult = await chatService.getSession(savedSessionId);
    if (sessionResult.success && sessionResult.session.status !== 'CLOSED') {
      setConnectionStatus('connected');
      chatService.startPolling();

      if (sessionResult.session.agentId) {
        setAgent({ id: sessionResult.session.agentId, name: sessionResult.session.agentId });
      }
    } else {
      // Session is closed or invalid, reset state
      localStorage.removeItem(STORAGE_KEYS.CHAT_SESSION);
      localStorage.removeItem(STORAGE_KEYS.CHAT_STARTED);
      setChatStarted(false);
      setSessionId(null);
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      });
    }
  };

  useEffect(() => {
    scrollToBottom(messages.length > 1);
  }, [messages]);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'agent') {
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [messages, isOpen]);

  // Reset unread count when opening chat
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const handleChatEvent = useCallback((event) => {
    switch (event.type) {
      case 'connected':
        setConnectionStatus('connected');
        break;
      case 'disconnected':
        setConnectionStatus('disconnected');
        break;
      case 'connection_failed':
        setConnectionStatus('disconnected');
        addSystemMessage('Connection failed. Please try again.');
        break;
      case 'message':
        setIsTyping(false);
        const msg = event.message;
        const messageType = msg.senderType === 'USER' ? 'user' :
                           msg.senderType === 'SYSTEM' ? 'system' : 'agent';
        if (msg.senderType !== 'USER') {
          setMessages(prev => [...prev, {
            id: msg.id || msg.messageId || Date.now(),
            type: messageType,
            text: msg.content || msg.text,
            time: new Date(msg.createdAt || msg.time || Date.now()),
            agentName: msg.senderId,
          }]);
        }
        break;
      case 'agent_join':
        setAgent(event.agent);
        setConnectionStatus('connected');
        addSystemMessage(`${event.agent.name || 'Support Agent'} has joined the chat.`);
        break;
      case 'agent_leave':
        setAgent(null);
        addSystemMessage('The agent has left. You can start a new chat.');
        break;
      case 'typing':
        setIsTyping(event.isTyping);
        break;
      case 'chat_ended':
        setAgent(null);
        setConnectionStatus('disconnected');
        addSystemMessage('Chat ended. Thank you for contacting us!');
        setShowRating(true);
        break;
      default:
        break;
    }
  }, []);

  const addSystemMessage = (text) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'system',
      text,
      time: new Date(),
    }]);
  };

  useEffect(() => {
    const accountId = user?.accountId || user?.id;
    if (!isAuthenticated || !accountId) return;
    const unsubscribe = chatService.subscribe(handleChatEvent);
    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, user?.accountId, user?.id, handleChatEvent]);

  const handleToggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleCloseChat = () => {
    setIsOpen(false);
  };

  const handleStartChat = async () => {
    const accountId = user?.accountId || user?.id;
    if (!accountId) return;

    setChatStarted(true);
    setConnectionStatus('connecting');
    setShowRating(false);
    setRatingSubmitted(false);
    setMessages([{
      id: 1,
      type: 'system',
      text: 'Connecting you to a support agent...',
      time: new Date(),
    }]);

    try {
      const userName = user?.fullName || user?.firstName || user?.name || 'User';
      const result = await chatService.connect(accountId, 'Support Request', userName);

      if (result.success) {
        setSessionId(result.sessionId);

        if (result.status === 'WAITING') {
          setConnectionStatus('waiting');
          addSystemMessage('Connected! Waiting for an agent to join...');
        } else if (result.status === 'ACTIVE' && result.agentId) {
          setAgent({ id: result.agentId, name: result.agentId });
          setConnectionStatus('connected');
          addSystemMessage('Connected to support agent!');
        } else {
          setConnectionStatus('connected');
          addSystemMessage('Connected! An agent will be with you shortly.');
        }

        const messagesResult = await chatService.getMessages(result.sessionId);
        if (messagesResult.success && messagesResult.messages?.length > 0) {
          const existingMessages = messagesResult.messages.map(msg => ({
            id: msg.messageId,
            type: msg.senderType === 'USER' ? 'user' : (msg.senderType === 'SYSTEM' ? 'system' : 'agent'),
            text: msg.content,
            time: new Date(msg.createdAt),
            agentName: msg.senderId,
          }));
          setMessages(prev => [...prev, ...existingMessages]);
        }
      } else {
        setConnectionStatus('disconnected');
        addSystemMessage(result.error || 'Unable to connect. Please try again later.');
      }
    } catch (error) {
      console.error('Chat connection error:', error);
      setConnectionStatus('disconnected');
      addSystemMessage('Connection failed. Try contacting us via Telegram.');
    }
  };

  const handleEndChat = async () => {
    const currentSessionId = chatService.getSessionId();
    await chatService.closeSession(currentSessionId);
    setAgent(null);
    setConnectionStatus('disconnected');
    setShowRating(true);
  };

  const handleSubmitRating = async () => {
    if (rating > 0) {
      const currentSessionId = sessionId || chatService.getSessionId();
      if (currentSessionId) {
        await chatService.rateSession(rating, feedback, currentSessionId);
      }
    }
    setRatingSubmitted(true);
    setTimeout(() => {
      setShowRating(false);
      setChatStarted(false);
      setMessages([]);
      setRating(0);
      setFeedback('');
      setSessionId(null);
      // Clear localStorage
      localStorage.removeItem(STORAGE_KEYS.CHAT_SESSION);
      localStorage.removeItem(STORAGE_KEYS.CHAT_MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.CHAT_STARTED);
    }, 2000);
  };

  const handleSkipRating = () => {
    setShowRating(false);
    setChatStarted(false);
    setMessages([]);
    setRating(0);
    setFeedback('');
    setSessionId(null);
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.CHAT_SESSION);
    localStorage.removeItem(STORAGE_KEYS.CHAT_MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.CHAT_STARTED);
  };

  const handleSend = async (messageText = input) => {
    const text = messageText.trim();
    if (!text || !sessionId) return;

    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      text,
      time: new Date(),
    }]);
    setInput('');

    const result = await chatService.sendMessage(text);
    if (!result.success) {
      addSystemMessage('Failed to send message. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        className={`floating-chat-btn ${isOpen ? 'hidden' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={handleToggleChat}
        title="Live Support"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        <span className="chat-label">24/7</span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="floating-chat-window">
          {/* Chat Header */}
          <div className="fchat-header">
            <div className="fchat-header-info">
              <div className={`fchat-avatar ${agent ? 'has-agent' : ''}`}>
                {agent ? agent.name.charAt(0).toUpperCase() : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
              </div>
              <div className="fchat-header-text">
                <span className="fchat-title">{agent ? agent.name : 'Support Team'}</span>
                <span className={`fchat-status ${connectionStatus}`}>
                  <span className="status-dot"></span>
                  {connectionStatus === 'connecting' && 'Connecting...'}
                  {connectionStatus === 'waiting' && 'Waiting for agent...'}
                  {connectionStatus === 'connected' && (agent ? 'Online' : 'Connected')}
                  {connectionStatus === 'disconnected' && 'Offline'}
                </span>
              </div>
            </div>
            <button className="fchat-close-btn" onClick={handleCloseChat} title="Close chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Chat Body */}
          <div className="fchat-body">
            {!chatStarted ? (
              /* Welcome Screen */
              <div className="fchat-welcome">
                <div className="fchat-welcome-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <h3>Welcome to Team33 Support</h3>
                <p>How can we help you today?</p>

                {isAuthenticated ? (
                  <button className="fchat-start-btn" onClick={handleStartChat}>
                    Start Chat
                  </button>
                ) : (
                  <div className="fchat-login-prompt">
                    <p>Please login to chat with us</p>
                    <a href="/login" className="fchat-login-btn">Login</a>
                  </div>
                )}

                <div className="fchat-social-links">
                  <span>Or reach us via:</span>
                  <div className="fchat-social-btns">
                    <a href="https://t.me/Team33" target="_blank" rel="noopener noreferrer" title="Telegram">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
                      </svg>
                    </a>
                    <a href="https://wa.me/1234567890" target="_blank" rel="noopener noreferrer" title="WhatsApp">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            ) : showRating ? (
              /* Rating Screen */
              <div className="fchat-rating">
                {!ratingSubmitted ? (
                  <>
                    <h4>Rate Your Experience</h4>
                    <p>How was your chat?</p>
                    <div className="fchat-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          className={`star-btn ${rating >= star ? 'active' : ''}`}
                          onClick={() => setRating(star)}
                        >
                          <svg width="28" height="28" viewBox="0 0 24 24" fill={rating >= star ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        </button>
                      ))}
                    </div>
                    <textarea
                      placeholder="Additional feedback (optional)"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={2}
                    />
                    <div className="fchat-rating-btns">
                      <button className="submit-btn" onClick={handleSubmitRating} disabled={rating === 0}>
                        Submit
                      </button>
                      <button className="skip-btn" onClick={handleSkipRating}>
                        Skip
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="fchat-rating-success">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <h4>Thank You!</h4>
                    <p>Your feedback helps us improve.</p>
                  </div>
                )}
              </div>
            ) : (
              /* Messages Area */
              <>
                <div className="fchat-messages" ref={messagesContainerRef}>
                  {messages.map(msg => (
                    <div key={msg.id} className={`fchat-msg fchat-msg-${msg.type}`}>
                      {msg.type === 'agent' && (
                        <div className="fchat-msg-avatar">
                          {msg.agentName ? msg.agentName.charAt(0) : 'A'}
                        </div>
                      )}
                      <div className="fchat-msg-content">
                        <div className="fchat-msg-bubble">
                          <p>{msg.text}</p>
                        </div>
                        {msg.type !== 'system' && (
                          <span className="fchat-msg-time">{formatTime(msg.time)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="fchat-msg fchat-msg-agent">
                      <div className="fchat-msg-avatar">
                        {agent ? agent.name.charAt(0) : 'A'}
                      </div>
                      <div className="fchat-msg-bubble typing">
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="fchat-input-area">
                  {connectionStatus === 'connecting' && !sessionId ? (
                    <div className="fchat-connecting">
                      <div className="spinner"></div>
                      <span>Connecting...</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={sessionId ? 'Type a message...' : 'Connecting...'}
                        disabled={!sessionId}
                      />
                      <button
                        className="fchat-send-btn"
                        onClick={() => handleSend()}
                        disabled={!input.trim() || !sessionId}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="22" y1="2" x2="11" y2="13"/>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                {/* End Chat Button */}
                {sessionId && (
                  <button className="fchat-end-btn" onClick={handleEndChat}>
                    End Chat
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

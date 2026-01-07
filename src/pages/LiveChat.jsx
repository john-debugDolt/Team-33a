import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSmartResponse, getSuggestions } from '../services/chatService';
import './LiveChat.css';

const faqItems = [
  { question: 'How do I deposit?', answer: 'Go to Wallet > Deposit, choose your payment method, and follow the instructions. We support bank transfer, e-wallets, and crypto. Minimum deposit is $10.' },
  { question: 'How long do withdrawals take?', answer: 'Withdrawals are typically processed within 24-48 hours. Make sure you have completed any bonus wagering requirements before requesting a withdrawal.' },
  { question: 'What is the minimum deposit?', answer: 'The minimum deposit is $10 for most payment methods. Some payment methods may have different minimums.' },
  { question: 'How do I claim bonuses?', answer: 'Visit the Promotions page and click "Claim" on any available bonus. Read the terms and wagering requirements before claiming.' },
  { question: 'How do I verify my account?', answer: 'Go to Settings > Verification. Upload a valid government ID and proof of address. Verification takes 24-48 hours.' },
  { question: 'What VIP levels are there?', answer: 'We have 5 VIP tiers: Bronze, Silver, Gold, Platinum, and Diamond. Higher levels get better bonuses, faster withdrawals, and exclusive rewards!' },
];

export default function LiveChat() {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'system',
      text: 'Welcome to Team33 Live Support! I\'m your AI assistant and I\'m here to help. Ask me anything about deposits, withdrawals, bonuses, games, or your account!',
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState(['How do I deposit?', 'What bonuses are available?', 'How do I withdraw?']);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (messageText = input) => {
    const text = messageText.trim();
    if (!text) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: text,
      time: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Simulate typing indicator
    setIsTyping(true);

    // Get smart AI response
    setTimeout(() => {
      setIsTyping(false);
      const response = getSmartResponse(text);

      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'agent',
        text: response.text,
        time: new Date(),
      }]);

      // Update suggestions based on the topic
      if (response.topic) {
        const newSuggestions = getSuggestions(response.topic);
        setSuggestions(newSuggestions);
      }
    }, 800 + Math.random() * 700);
  };

  const handleFaqClick = (faq) => {
    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: faq.question,
      time: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'agent',
        text: faq.answer,
        time: new Date(),
      }]);
    }, 500);
  };

  const handleSuggestionClick = (suggestion) => {
    handleSend(suggestion);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="livechat-page">
      <div className="livechat-container">
        {/* Sidebar */}
        <div className="livechat-sidebar">
          <div className="sidebar-section">
            <h3>Contact Us</h3>
            <div className="contact-options">
              <a href="https://t.me/Team33" target="_blank" rel="noopener noreferrer" className="contact-btn telegram">
                <span className="contact-icon">✈️</span>
                <span>Telegram @Team33</span>
              </a>
              <a href="mailto:support@team33.com" className="contact-btn email">
                <span className="contact-icon">✉️</span>
                <span>Email Support</span>
              </a>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Quick Help</h3>
            <div className="faq-list">
              {faqItems.map((faq, index) => (
                <button
                  key={index}
                  className="faq-btn"
                  onClick={() => handleFaqClick(faq)}
                >
                  {faq.question}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section support-hours">
            <h3>AI Support</h3>
            <p>24/7 Instant Responses</p>
            <p className="support-note">Human support via Telegram</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-area">
          <div className="chat-header">
            <div className="chat-agent">
              <div className="agent-avatar">AI</div>
              <div className="agent-info">
                <span className="agent-name">Team33 AI Assistant</span>
                <span className="agent-status">
                  <span className="status-dot"></span>
                  Always Online
                </span>
              </div>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message message-${msg.type}`}>
                {(msg.type === 'agent' || msg.type === 'system') && (
                  <div className="message-avatar">AI</div>
                )}
                <div className="message-content">
                  <p>{msg.text}</p>
                  <span className="message-time">{formatTime(msg.time)}</span>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="message message-agent">
                <div className="message-avatar">AI</div>
                <div className="message-content typing">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {isAuthenticated && suggestions.length > 0 && !isTyping && (
            <div className="chat-suggestions">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  className="suggestion-btn"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-area">
            {!isAuthenticated && (
              <div className="login-prompt">
                Please log in to send messages
              </div>
            )}
            <div className="chat-input-wrap">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isAuthenticated ? "Type your message... (e.g., 'How do I deposit?')" : "Log in to chat"}
                disabled={!isAuthenticated}
              />
              <button
                className="send-btn"
                onClick={() => handleSend()}
                disabled={!isAuthenticated || !input.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

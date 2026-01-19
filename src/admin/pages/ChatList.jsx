import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMessageSquare, FiVolume2, FiVolumeX, FiUser, FiClock, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { adminChatService } from '../services/adminChatService';
import { chatStorageService } from '../../services/chatStorageService';

const ChatList = () => {
  const navigate = useNavigate();
  const [soundOn, setSoundOn] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('');

  const filters = ['ALL', 'WAITING', 'ACTIVE', 'CLOSED'];

  // Delete a chat session
  const handleDeleteChat = async (e, chat) => {
    e.stopPropagation(); // Prevent navigation
    if (!confirm(`Delete chat with ${chat.username}? This cannot be undone.`)) return;

    try {
      // Close session first if not already closed
      if (chat.status !== 'CLOSED') {
        await adminChatService.closeSession(chat.sessionId);
      }
      // Remove from local cache
      chatStorageService.deleteSession(chat.sessionId);
      // Refresh list
      fetchSessions();
    } catch (err) {
      console.error('Delete chat error:', err);
      alert('Failed to delete chat');
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) > 1 ? 's' : ''} ago`;
    return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) > 1 ? 's' : ''} ago`;
  };

  // Fetch sessions from API
  const fetchSessions = useCallback(async () => {
    try {
      const statusParam = activeFilter === 'ALL' ? null : activeFilter;
      const result = await adminChatService.getAllSessions(statusParam);

      if (result.success) {
        // Transform sessions to chat format
        const formattedChats = result.sessions.map((session, index) => ({
          id: session.sessionId || session.id || index,
          sessionId: session.sessionId || session.id,
          username: session.userName || session.accountId || session.userId || 'Unknown User',
          subject: session.subject || 'General Inquiry',
          message: session.lastMessage || session.subject || 'New chat session',
          time: formatTimeAgo(session.lastMessageAt || session.updatedAt || session.createdAt),
          unread: session.unreadCount || 0,
          status: session.status || 'WAITING',
          createdAt: session.createdAt
        }));

        // Sort by most recent first
        formattedChats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setChats(formattedChats);
        setDataSource(result.source || '');
        setError(result.error || null);
      } else {
        setError(result.error || 'Failed to fetch sessions');
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  // Initial fetch and polling setup
  useEffect(() => {
    setLoading(true);
    fetchSessions();

    // Set up polling every 5 seconds
    const pollInterval = setInterval(fetchSessions, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [fetchSessions]);

  // Play notification sound for new messages
  useEffect(() => {
    if (soundOn && chats.some(chat => chat.unread > 0 && chat.status === 'WAITING')) {
      // Could add audio notification here
    }
  }, [chats, soundOn]);

  // Handle chat click
  const handleChatClick = (chat) => {
    navigate(`/chat/${chat.sessionId}`);
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'WAITING':
        return '#f59e0b';
      case 'ACTIVE':
        return '#22c55e';
      case 'CLOSED':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  // Get counts for each status
  const getCounts = (status) => {
    if (activeFilter !== 'ALL') {
      return chats.length;
    }
    return chats.filter(c => c.status === status).length;
  };

  // Filter chats based on active filter
  const filteredChats = activeFilter === 'ALL'
    ? chats
    : chats.filter(c => c.status === activeFilter);

  return (
    <div className="chat-list-page">
      {/* Chat Filters */}
      <div className="chat-filters">
        {filters.map((filter) => (
          <button
            key={filter}
            className={`chat-filter-link ${activeFilter === filter ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
            {filter !== 'ALL' && (
              <span style={{ marginLeft: '6px', opacity: 0.7 }}>
                ({getCounts(filter)})
              </span>
            )}
          </button>
        ))}
        <span className="sound-toggle" style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={fetchSessions}
            disabled={loading}
            title="Refresh"
          >
            <FiRefreshCw className={loading ? 'spin' : ''} />
          </button>
          <button
            className={`btn btn-sm ${soundOn ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSoundOn(!soundOn)}
          >
            {soundOn ? <FiVolume2 /> : <FiVolumeX />}
            <span style={{ marginLeft: '6px' }}>{soundOn ? 'Sound On' : 'Sound Off'}</span>
          </button>
        </span>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '10px 15px',
          margin: '0 0 15px 0',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{error}</span>
          <button
            onClick={fetchSessions}
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Data source indicator */}
      {dataSource && dataSource !== 'api' && chats.length > 0 && (
        <div style={{
          padding: '8px 15px',
          background: '#fef3c7',
          color: '#92400e',
          fontSize: '12px',
          marginBottom: '10px',
          borderRadius: '6px'
        }}>
          Showing cached data. Live server data may differ.
        </div>
      )}

      {/* Chat List */}
      <div className="content-inner">
        {loading && chats.length === 0 ? (
          <div className="empty-state">
            <div className="loading-spinner" style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 15px'
            }} />
            <p className="empty-state-text">Loading chats...</p>
          </div>
        ) : filteredChats.length > 0 ? (
          <div className="card">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                className="chat-item"
                onClick={() => handleChatClick(chat)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '15px 20px',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  background: chat.status === 'WAITING' ? 'rgba(245, 158, 11, 0.05)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = chat.status === 'WAITING' ? 'rgba(245, 158, 11, 0.05)' : 'transparent'}
              >
                <div
                  style={{
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    background: chat.status === 'WAITING' ? '#fef3c7' : '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '15px',
                    flexShrink: 0
                  }}
                >
                  <FiUser size={20} color={chat.status === 'WAITING' ? '#f59e0b' : '#6b7280'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ marginRight: '8px' }}>{chat.username}</strong>
                    <span
                      className="badge"
                      style={{
                        fontSize: '10px',
                        backgroundColor: getStatusColor(chat.status),
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '10px'
                      }}
                    >
                      {chat.status}
                    </span>
                  </div>
                  <p style={{
                    margin: 0,
                    color: '#374151',
                    fontSize: '13px',
                    fontWeight: chat.unread > 0 ? '500' : 'normal'
                  }}>
                    {chat.subject}
                  </p>
                  <p style={{
                    margin: '2px 0 0 0',
                    color: '#6b7280',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {chat.message}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '15px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    <FiClock size={12} style={{ marginRight: '4px' }} />
                    {chat.time}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {chat.unread > 0 && (
                      <span
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                          borderRadius: '10px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        {chat.unread}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteChat(e, chat)}
                      title="Delete chat"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        color: '#9ca3af',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => { e.target.style.color = '#dc2626'; e.target.style.background = '#fee2e2'; }}
                      onMouseLeave={(e) => { e.target.style.color = '#9ca3af'; e.target.style.background = 'transparent'; }}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <FiMessageSquare size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
            <p className="empty-state-text">
              {activeFilter === 'ALL' ? 'No chat sessions yet' : `No ${activeFilter.toLowerCase()} chats`}
            </p>
            {activeFilter !== 'ALL' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setActiveFilter('ALL')}
                style={{ marginTop: '10px' }}
              >
                View All Chats
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        .chat-item:hover {
          background: #f9fafb !important;
        }
      `}</style>
    </div>
  );
};

export default ChatList;

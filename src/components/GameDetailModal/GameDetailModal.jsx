import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Modal from '../Modal/Modal';
import './GameDetailModal.css';

export default function GameDetailModal({ game, onClose }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  if (!game) return null;

  const handlePlayNow = () => {
    if (!isAuthenticated) {
      showToast('Please login to play', 'warning');
      navigate('/login');
      onClose();
      return;
    }
    showToast(`Launching ${game.name}...`, 'info');
    // In real app, this would open the game in iframe or redirect
  };

  const handleTryDemo = () => {
    showToast(`Loading ${game.name} demo...`, 'info');
    // In real app, this would open demo mode
  };

  return (
    <Modal onClose={onClose} size="large">
      <div className="game-detail">
        <div className="game-detail-header">
          <div className="game-detail-image">
            <img src={game.image} alt={game.name} />
            <div className="game-badges">
              {game.isHot && <span className="badge badge-hot">HOT</span>}
              {game.isNew && <span className="badge badge-new">NEW</span>}
            </div>
          </div>

          <div className="game-detail-info">
            <div className="game-provider">{game.provider}</div>
            <h2 className="game-title">{game.name}</h2>

            <div className="game-rating">
              <span className="stars">{'★'.repeat(Math.floor(game.rating))}</span>
              <span className="rating-value">{game.rating}</span>
              <span className="play-count">{game.playCount?.toLocaleString()} plays</span>
            </div>

            <p className="game-description">{game.description}</p>

            <div className="game-actions">
              <button className="btn-play" onClick={handlePlayNow}>
                Play Now
              </button>
              <button className="btn-demo" onClick={handleTryDemo}>
                Try Demo
              </button>
            </div>
          </div>
        </div>

        <div className="game-detail-stats">
          <div className="stat-item">
            <span className="stat-label">RTP</span>
            <span className="stat-value">{game.rtp}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Volatility</span>
            <span className="stat-value">{game.volatility}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Min Bet</span>
            <span className="stat-value">${game.minBet}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Max Bet</span>
            <span className="stat-value">${game.maxBet}</span>
          </div>
        </div>

        {game.features && game.features.length > 0 && (
          <div className="game-features">
            <h3>Game Features</h3>
            <div className="features-list">
              {game.features.map((feature, index) => (
                <span key={index} className="feature-tag">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

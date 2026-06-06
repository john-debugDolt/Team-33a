import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { gameService } from '../../services/gameService';
import Modal from '../Modal/Modal';
import './GameDetailModal.css';

export default function GameDetailModal({ game, onClose, onPlayGame }) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [launching, setLaunching] = useState(false);

  if (!game) return null;

  const handlePlayNow = async () => {
    if (!isAuthenticated) {
      showToast('Please login to play', 'warning');
      navigate('/login');
      onClose();
      return;
    }

    if (launching) return;

    setLaunching(true);
    showToast(`Launching ${game.name}...`, 'info');

    try {
      const result = await gameService.requestGameUrl(game.id, user?.accountId);

      if (result.success && result.gameUrl) {
        // Use embedded player if callback provided, otherwise open new tab
        if (onPlayGame) {
          onPlayGame({ url: result.gameUrl, name: game.name });
          onClose();
        } else {
          window.open(result.gameUrl, '_blank');
        }
        showToast(`${game.name} launched!`, 'success');
      } else {
        showToast(result.error || 'Failed to launch game', 'error');
      }
    } catch (error) {
      console.error('Game launch error:', error);
      showToast('Failed to launch game. Please try again.', 'error');
    } finally {
      setLaunching(false);
    }
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
              <button
                className={`btn-play ${launching ? 'loading' : ''}`}
                onClick={handlePlayNow}
                disabled={launching}
              >
                {launching ? 'Launching...' : 'Play Now'}
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

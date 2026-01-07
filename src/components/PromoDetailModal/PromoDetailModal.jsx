import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { promotionService } from '../../services/promotionService';
import Modal from '../Modal/Modal';
import './PromoDetailModal.css';

export default function PromoDetailModal({ promotion, onClose }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  if (!promotion) return null;

  const handleClaim = async () => {
    if (!isAuthenticated) {
      showToast('Please login to claim this promotion', 'warning');
      navigate('/login');
      onClose();
      return;
    }

    const result = await promotionService.claimPromotion(promotion.id);
    if (result.success) {
      showToast(result.message, 'success');
      onClose();
    } else {
      showToast(result.message || 'Failed to claim promotion', 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Modal onClose={onClose} size="medium">
      <div className="promo-detail">
        <div className="promo-detail-image">
          <img src={promotion.image} alt={promotion.title} />
          <span className="promo-category">{promotion.category}</span>
        </div>

        <div className="promo-detail-content">
          <h2 className="promo-title">{promotion.title}</h2>
          <p className="promo-subtitle">{promotion.subtitle}</p>

          <div className="promo-meta">
            <div className="meta-item">
              <span className="meta-label">Bonus</span>
              <span className="meta-value highlight">{promotion.bonusAmount}</span>
            </div>
            {promotion.maxBonus && (
              <div className="meta-item">
                <span className="meta-label">Max Bonus</span>
                <span className="meta-value">${promotion.maxBonus}</span>
              </div>
            )}
            {promotion.minDeposit > 0 && (
              <div className="meta-item">
                <span className="meta-label">Min Deposit</span>
                <span className="meta-value">${promotion.minDeposit}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-label">Wagering</span>
              <span className="meta-value">{promotion.wageringRequirement}x</span>
            </div>
          </div>

          <div className="promo-validity">
            Valid: {formatDate(promotion.validFrom)} - {formatDate(promotion.validUntil)}
          </div>

          <div
            className="promo-description"
            dangerouslySetInnerHTML={{ __html: promotion.description }}
          />

          {promotion.terms && promotion.terms.length > 0 && (
            <div className="promo-terms">
              <h3>Terms & Conditions</h3>
              <ul>
                {promotion.terms.map((term, index) => (
                  <li key={index}>{term}</li>
                ))}
              </ul>
            </div>
          )}

          <button className="btn-claim" onClick={handleClaim}>
            Claim Now
          </button>
        </div>
      </div>
    </Modal>
  );
}

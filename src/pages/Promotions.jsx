import { useState, useEffect } from 'react'
import { promotionService, promotionCategories } from '../services/promotionService'
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner'
import PromoDetailModal from '../components/PromoDetailModal/PromoDetailModal'
import './Promotions.css'

export default function Promotions() {
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [selectedPromotion, setSelectedPromotion] = useState(null)

  const fetchPromotions = async () => {
    setLoading(true)
    const result = await promotionService.getPromotions({ category: activeCategory })
    if (result.success) {
      setPromotions(result.data.promotions)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchPromotions()
  }, [activeCategory])

  return (
    <div className="promotions-page">
      {/* Hero Section */}
      <div className="promo-hero">
        <div className="promo-hero-bg"></div>

        <div className="promo-content">
          {/* Category Tabs */}
          <div className="promo-categories">
            {promotionCategories.map((cat) => (
              <button
                key={cat.id}
                className={`promo-category ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Promotions Grid */}
          {loading ? (
            <div className="promo-loading">
              <LoadingSpinner text="Loading promotions..." />
            </div>
          ) : promotions.length === 0 ? (
            <div className="promo-empty">
              <span className="empty-icon">🎁</span>
              <h3>No promotions found</h3>
              <p>Check back later for new offers</p>
            </div>
          ) : (
            <div className="promo-grid">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="promo-card"
                  onClick={() => setSelectedPromotion(promo)}
                >
                  <div className="promo-card-image">
                    <img src={promo.image} alt={promo.title} />
                    <span className="promo-badge">{promo.category}</span>
                    <div className="promo-card-overlay">
                      <button className="claim-btn">View Details</button>
                    </div>
                  </div>
                  <div className="promo-card-info">
                    <h3>{promo.title}</h3>
                    <p className="promo-subtitle">{promo.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Marquee */}
      <div className="marquee">
        <span className="marquee-icon">📢</span>
        <div className="marquee-text">
          <span>Telegram: @Team33 | Check out our latest promotions!</span>
        </div>
      </div>

      {/* Promotion Detail Modal */}
      {selectedPromotion && (
        <PromoDetailModal
          promotion={selectedPromotion}
          onClose={() => setSelectedPromotion(null)}
        />
      )}
    </div>
  )
}

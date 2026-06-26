/**
 * Bonus Service for Site Frontend
 *
 * Player-side endpoints live on accounts.team33.mx per the
 * 2026-06-18 bonus/rollover/conversion spec at docs/bonus-rollover-conversion.md
 *
 * Catalogue:
 *   GET  /api/bonuses/available                        — list player-visible bonuses
 *   GET  /api/bonuses/{bonusId}                        — single bonus
 *   GET  /api/bonuses/validate/{code}                  — accept a typed promo code
 *
 * Player history + claim:
 *   GET  /api/bonuses/my-claims/{accountId}            — claim history (newest first)
 *   POST /api/bonuses/claim                            — claim a free bonus (minDeposit=0)
 *
 * The legacy /api/bonuses/filter?isActive=true path returns 400 against
 * accounts.team33.mx in production — verified 2026-06-18. We use /available.
 */

const PLAYER_BASE_URL = 'https://accounts.team33.mx';

const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

// IP detection — the bonus claim endpoint requires the player's egress IP
// (the upstream uses it for fraud control / IP-binding). Browsers can't
// read their own external IP, so we fetch it from a lightweight public
// service and cache the result for the rest of the tab session.
let cachedIp = null;
let cachedIpAt = 0;
const IP_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min — players don't change IPs often

export const getClientIpAddress = async () => {
  if (cachedIp && Date.now() - cachedIpAt < IP_CACHE_TTL_MS) return cachedIp;
  // ipify is widely used + has open CORS. Falls back to null on any error;
  // the claim endpoint will then surface a 400 the player can act on.
  try {
    const res = await fetchWithTimeout('https://api.ipify.org?format=json', {}, 5000);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.ip) {
      cachedIp = String(data.ip);
      cachedIpAt = Date.now();
      return cachedIp;
    }
  } catch { /* ignore — return null */ }
  return null;
};

// Bonus types for display
export const BONUS_TYPE_LABELS = {
  FIRST_DEPOSIT: 'First Deposit',
  RELOAD: 'Reload Bonus',
  REFERRAL: 'Referral Bonus',
  CASHBACK: 'Cashback',
  FREE_SPIN: 'Free Spins',
  LOYALTY: 'VIP Reward',
  PROMOTIONAL: 'Special Promo',
  PERCENTAGE: 'Match Bonus',
  FIXED: 'Fixed Bonus'
};

// Bonus type icons for UI
export const BONUS_TYPE_ICONS = {
  FIRST_DEPOSIT: '🎁',
  RELOAD: '🔄',
  REFERRAL: '👥',
  CASHBACK: '💰',
  FREE_SPIN: '🎰',
  LOYALTY: '👑',
  PROMOTIONAL: '🎉',
  PERCENTAGE: '📈',
  FIXED: '💵'
};

class BonusService {
  /**
   * GET /api/bonuses/available — player-visible active bonuses.
   *
   * requires_code=true bonuses are filtered out server-side. The list is
   * already player-safe; we additionally drop SYSTEM_* internal rows in case
   * any leak through. The description field contains the full T&C text
   * (with unicode arrows / newlines) for direct rendering in the detail
   * popup.
   */
  async getAvailableBonuses() {
    try {
      const res = await fetchWithTimeout(`${PLAYER_BASE_URL}/api/bonuses/available`);
      if (!res.ok) {
        console.warn('[BonusService] /available returned', res.status);
        return [];
      }
      const list = await res.json();
      if (!Array.isArray(list)) return [];
      return list.filter(b => !String(b.bonusCode || '').startsWith('SYSTEM_'));
    } catch (error) {
      console.error('[BonusService] Error fetching /available:', error);
      return [];
    }
  }

  // Back-compat alias — older callers used getActiveBonuses().
  async getActiveBonuses() {
    return this.getAvailableBonuses();
  }

  /**
   * GET /api/bonuses/validate/{code} — used when the user types a code on
   * the deposit page. Returns the bonus row if valid, null on 4xx/5xx.
   *
   * (Note: the upstream currently 500s on unknown codes instead of 400ing
   * with a message. Treat any non-200 as "not a valid code".)
   */
  async validateBonusCode(code) {
    if (!code) return null;
    try {
      const res = await fetchWithTimeout(
        `${PLAYER_BASE_URL}/api/bonuses/validate/${encodeURIComponent(code)}`
      );
      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error('[BonusService] validate failed:', error);
      return null;
    }
  }

  /**
   * GET /api/bonuses/{bonusId} — single bonus by numeric id.
   */
  async getBonusById(bonusId) {
    if (!bonusId) return null;
    try {
      const res = await fetchWithTimeout(
        `${PLAYER_BASE_URL}/api/bonuses/${bonusId}`
      );
      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error('[BonusService] getBonusById failed:', error);
      return null;
    }
  }

  /**
   * Synthesize a rollover snapshot from /api/bonuses/my-claims rows. The
   * authoritative /api/bonus-wallet/{id}/rollover endpoint is currently
   * unreliable, so we aggregate the per-claim figures that the claims
   * endpoint already exposes: bonusAmount, turnoverRequired,
   * rolloverCompleted.
   *
   * Only CREDITED claims contribute — EXPIRED rows are historical and
   * would falsely inflate the wagering target.
   *
   * Output shape mirrors getRolloverProgress() so RolloverCard renders
   * without changes:
   *   { balance, originalBonusCredited, rolloverDenominator,
   *     rolloverCompleted (0..1 fraction) }
   */
  deriveRolloverFromClaims(claims) {
    if (!Array.isArray(claims) || claims.length === 0) return null
    const active = claims.filter(c => String(c.status || '').toUpperCase() === 'CREDITED')
    if (active.length === 0) return null
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
    const sumBonus = active.reduce((s, c) => s + num(c.bonusAmount), 0)
    const sumRequired = active.reduce((s, c) => s + num(c.turnoverRequired), 0)
    const sumCompleted = active.reduce((s, c) => s + num(c.rolloverCompleted), 0)
    const fraction = sumRequired > 0 ? Math.min(1, sumCompleted / sumRequired) : 0
    return {
      balance: sumBonus,
      originalBonusCredited: sumBonus,
      rolloverDenominator: sumRequired,
      rolloverCompleted: fraction,
    }
  }

  /**
   * GET /api/bonuses/my-claims/{accountId} — claim history (newest first).
   * Returns [] for unknown accounts or any error so the UI can render an
   * empty state cleanly.
   */
  async getMyClaims(accountId) {
    if (!accountId) return [];
    try {
      const res = await fetchWithTimeout(
        `${PLAYER_BASE_URL}/api/bonuses/my-claims/${encodeURIComponent(accountId)}`
      );
      if (!res.ok) return [];
      const list = await res.json();
      return Array.isArray(list) ? list : [];
    } catch (error) {
      console.error('[BonusService] getMyClaims failed:', error);
      return [];
    }
  }

  /**
   * Format bonus for display in promo cards
   */
  formatBonusForDisplay(bonus) {
    const isPercentage = bonus.bonusType === 'PERCENTAGE';

    return {
      id: bonus.id,
      code: bonus.bonusCode,
      title: bonus.displayName,
      description: bonus.description || '',
      type: bonus.bonusType,
      typeLabel: BONUS_TYPE_LABELS[bonus.bonusType] || bonus.bonusType,
      icon: BONUS_TYPE_ICONS[bonus.bonusType] || '🎁',

      // Value display
      value: bonus.bonusValue,
      valueDisplay: isPercentage
        ? `${bonus.bonusValue}%`
        : `$${bonus.bonusValue?.toFixed(0) || '0'}`,

      // Max bonus
      maxBonus: bonus.maxBonusAmount,
      maxBonusDisplay: bonus.maxBonusAmount
        ? `Up to $${bonus.maxBonusAmount}`
        : 'Unlimited',

      // Requirements
      minDeposit: bonus.minDeposit || 0,
      minDepositDisplay: bonus.minDeposit > 0
        ? `Min. deposit: $${bonus.minDeposit}`
        : 'No minimum',

      turnover: bonus.turnoverMultiplier || 0,
      turnoverDisplay: bonus.turnoverMultiplier > 0
        ? `${bonus.turnoverMultiplier}x turnover`
        : 'No wagering',

      // Availability
      remainingClaims: bonus.remainingClaims,
      isLimited: bonus.maxClaims !== null,
      availabilityDisplay: bonus.maxClaims
        ? `${bonus.remainingClaims || 0} left`
        : 'Unlimited',

      // Code requirement
      requiresCode: bonus.requiresCode || false,

      // Styling hints based on bonus value
      highlight: isPercentage && bonus.bonusValue >= 100,
      gradient: this.getGradientForBonus(bonus)
    };
  }

  /**
   * Get gradient colors based on bonus type/value
   */
  getGradientForBonus(bonus) {
    const type = bonus.bonusType;
    const value = bonus.bonusValue || 0;

    if (type === 'FIRST_DEPOSIT') {
      return 'linear-gradient(135deg, #6366f1, #8b5cf6)';
    }
    if (type === 'PERCENTAGE' && value >= 100) {
      return 'linear-gradient(135deg, #f59e0b, #ef4444)';
    }
    if (type === 'CASHBACK') {
      return 'linear-gradient(135deg, #10b981, #059669)';
    }
    if (type === 'LOYALTY' || type === 'FREE_SPIN') {
      return 'linear-gradient(135deg, #f59e0b, #d97706)';
    }
    if (type === 'REFERRAL') {
      return 'linear-gradient(135deg, #3b82f6, #2563eb)';
    }

    // Default gradient
    return 'linear-gradient(135deg, #6366f1, #8b5cf6)';
  }

  /**
   * Get headline text for bonus card
   */
  getBonusHeadline(bonus) {
    const formatted = this.formatBonusForDisplay(bonus);

    if (bonus.bonusType === 'PERCENTAGE') {
      if (bonus.maxBonusAmount) {
        return `${formatted.valueDisplay} MATCH UP TO $${bonus.maxBonusAmount}`;
      }
      return `${formatted.valueDisplay} MATCH BONUS`;
    }

    if (bonus.bonusType === 'FIXED') {
      return `GET $${bonus.bonusValue} FREE`;
    }

    if (bonus.bonusType === 'CASHBACK') {
      return `${formatted.valueDisplay} CASHBACK`;
    }

    return formatted.title.toUpperCase();
  }

  /**
   * Check if bonus is available to claim
   */
  isBonusAvailable(bonus) {
    if (!bonus.isActive) return false;
    if (bonus.isAvailable === false) return false;
    if (bonus.remainingClaims !== null && bonus.remainingClaims <= 0) return false;
    if (bonus.endDate && new Date(bonus.endDate) < new Date()) return false;
    return true;
  }

  /**
   * Claim a FREE bonus (minDeposit = 0)
   * POST /api/bonuses/claim
   * Credits bonus amount directly to user's wallet
   *
   * @param {string} accountId - User's account ID
   * @param {number} bonusId - Bonus ID (optional if bonusCode provided)
   * @param {string} bonusCode - Bonus code (optional if bonusId provided)
   */
  async claimFreeBonus(accountId, bonusId = null, bonusCode = null) {
    try {
      // The server requires the player's egress IP for IP-binding fraud
      // control. Resolve via ipify (cached per session). If we can't get
      // an IP at all the server will 400 — that's acceptable behaviour.
      const ipAddress = await getClientIpAddress();
      const body = { accountId, ipAddress };
      if (bonusId) body.bonusId = bonusId;
      if (bonusCode) body.bonusCode = bonusCode;

      const response = await fetchWithTimeout(
        `${PLAYER_BASE_URL}/api/bonuses/claim`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        20000,
      );

      const data = await response.json().catch(() => null);

      if (response.ok) {
        return {
          success: true,
          bonusAmount: data?.bonusAmount,
          status: data?.status,
          claimId: data?.id,
          turnoverRequired: data?.turnoverRequired,
          data,
        };
      }

      // Upstream currently 500s instead of 400 on most failures (verified
      // 2026-06-18). Treat 5xx as a generic outage so the player sees a
      // friendly toast instead of a cryptic stack trace.
      if (response.status >= 500) {
        return {
          success: false,
          status: response.status,
          error: 'Bonus service is having issues right now. Please try again shortly.',
        };
      }

      const msg = data?.message || '';
      if (msg.includes('already claimed this bonus today')) {
        return { success: false, error: msg, code: 'ALREADY_CLAIMED_TODAY' };
      }
      if (msg.includes('this week')) {
        return { success: false, error: msg, code: 'ALREADY_CLAIMED_THIS_WEEK' };
      }
      if (msg.toLowerCase().includes('already claimed')) {
        return { success: false, error: msg || 'You have already claimed this bonus' };
      }
      if (msg.includes('requires a deposit')) {
        return { success: false, error: msg };
      }
      if (msg.includes('not available')) {
        return { success: false, error: msg };
      }
      if (msg.toLowerCase().includes('weekly deposit')) {
        return { success: false, error: msg, code: 'WEEKLY_DEPOSIT_GATE' };
      }

      return {
        success: false,
        error: data.message || 'Failed to claim bonus'
      };
    } catch (error) {
      console.error('[BonusService] Error claiming free bonus:', error);
      return {
        success: false,
        error: 'Network error. Please try again.'
      };
    }
  }

  /**
   * Get user's bonus claims
   * GET /api/bonuses/claims/account/{accountId}
   */
  async getUserClaims(accountId) {
    try {
      const response = await apiClient.get(`/api/bonuses/claims/account/${accountId}`);

      if (Array.isArray(response)) {
        return response;
      }

      if (response.success && Array.isArray(response.data)) {
        return response.data;
      }

      return [];
    } catch (error) {
      console.error('[BonusService] Error fetching user claims:', error);
      return [];
    }
  }
}

export const bonusService = new BonusService();
export default bonusService;

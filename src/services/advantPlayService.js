/**
 * AdvantPlay — Transfer-Wallet Service (2026-06-21 spec)
 *
 * Catalogue still lives on the legacy seamless path:
 *   GET /api/advantplay/game/list?iconSize={size}
 *
 * Everything else (launch / exit / deposit / withdraw / balance / domain /
 * check / health) is now under the transfer-wallet family:
 *   /api/advantplay-transfer/*
 *
 * /launch is single-call: backend sweeps any leftover balance, deposits the
 * full main wallet, mints a token, and returns a launchUrl that points at
 * AdvantPlay's dynamic provider host (don't hardcode it client-side; the
 * URL changes when AdvantPlay rotates DNS).
 *
 * Currency ratio is 1:1; amounts are JSON numbers (4 fractional digits per
 * spec — trailing zeros may drop).
 *
 * Per doc §6 the upstream returns failure as success:false + errorCode
 * inside an HTTP 200, so callers must read errorCode, not response.status.
 */

const ADVANTPLAY_BASE_URL = 'https://accounts.team33.mx';
const ADVANTPLAY_TRANSFER_BASE = `${ADVANTPLAY_BASE_URL}/api/advantplay-transfer`;
const DEFAULT_LANG_CODE = 'en-US';
const DEFAULT_BACK_URL = 'https://team33.mx';

// Cache for AdvantPlay games
let cachedAdvantPlayGames = null;
let advantPlayCacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Available icon sizes for AdvantPlay games
export const ADVANTPLAY_ICON_SIZES = {
  THUMBNAIL: '66x67',      // Thumbnail
  SMALL: '112x112',        // Small grid
  DEFAULT: '150x150',      // Default grid
  MEDIUM: '200x200',       // Medium grid
  LARGE: '268x268',        // Large grid
  FEATURED: '300x300',     // Featured
  PORTRAIT: '492x660',     // Portrait banner
  BANNER: '870x570',       // Large banner
};

// Default icon size to use for game cards
const DEFAULT_ICON_SIZE = ADVANTPLAY_ICON_SIZES.MEDIUM; // 200x200 for good quality on game cards

/**
 * Get current language for icon selection
 * Maps app language codes to AdvantPlay language codes
 */
const getCurrentLanguage = () => {
  const lang = localStorage.getItem('language') || 'en';
  // AdvantPlay supports: en, cn, th, etc.
  if (lang.startsWith('zh') || lang === 'cn') return 'cn';
  if (lang === 'th') return 'th';
  return 'en';
};

/**
 * Extract icon URL from AdvantPlay game IconList
 * @param {Object} game - AdvantPlay game object
 * @param {string} iconSize - Desired icon size (e.g., '200x200')
 * @param {string} iconType - Icon type: 'bkg' (with background) or 'transparent'
 */
const getAdvantPlayIconUrl = (game, iconSize = DEFAULT_ICON_SIZE, iconType = 'bkg') => {
  if (!game || !game.IconList || !Array.isArray(game.IconList)) {
    return '/placeholder-game.png';
  }

  // Skip IconList entries that came back with Url:{} — AdvantPlay ships
  // those for languages they haven't localised art for yet, and they'd
  // look like a real match but resolve to a placeholder.
  const hasArt = (i) => i?.Url && Object.keys(i.Url).length > 0;

  const lang = getCurrentLanguage();
  let iconData = game.IconList.find((i) => i.Language === lang && hasArt(i));
  if (!iconData) iconData = game.IconList.find((i) => i.Language === 'en' && hasArt(i));
  if (!iconData) iconData = game.IconList.find(hasArt);

  if (!iconData || !iconData.Url) {
    return '/placeholder-game.png';
  }

  // Get icon URL for requested size
  const sizeData = iconData.Url[iconSize];
  if (sizeData) {
    // Prefer 'bkg' (background) for cards, 'transparent' for overlays
    return sizeData[iconType] || sizeData.bkg || sizeData.transparent || '/placeholder-game.png';
  }

  // Fallback to any available size
  const availableSizes = Object.keys(iconData.Url);
  if (availableSizes.length > 0) {
    const fallbackSize = iconData.Url[availableSizes[0]];
    return fallbackSize[iconType] || fallbackSize.bkg || fallbackSize.transparent || '/placeholder-game.png';
  }

  return '/placeholder-game.png';
};

/**
 * Get game name from AdvantPlay IconList based on current language
 */
const getAdvantPlayGameName = (game) => {
  if (!game) return 'Unknown Game';

  // If game has IconList with localized names
  if (game.IconList && Array.isArray(game.IconList)) {
    const lang = getCurrentLanguage();
    let iconData = game.IconList.find(i => i.Language === lang);
    if (!iconData) {
      iconData = game.IconList.find(i => i.Language === 'en');
    }
    if (iconData && iconData.Name) {
      return iconData.Name;
    }
  }

  // Fallback to GameCode
  return game.GameCode || 'Unknown Game';
};

/**
 * Map AdvantPlay category to internal category
 */
const mapAdvantPlayCategory = (gameCategory) => {
  if (!gameCategory || !Array.isArray(gameCategory)) return 'slot';

  const categoryMap = {
    'slot': 'slot',
    'table': 'table',
    'fishing': 'fishing',
    'crash': 'crash',
    'live': 'live_casino',
    'card': 'card_game',
    'arcade': 'instant_win',
  };

  // Check first category
  const firstCategory = gameCategory[0]?.toLowerCase() || 'slot';
  return categoryMap[firstCategory] || 'slot';
};

/**
 * Determine if game is hot/popular based on GameTag
 */
const isGameHot = (game) => {
  const tag = (game.GameTag || '').toUpperCase();
  return tag.includes('TOP') || tag.includes('HOT') || tag.includes('POPULAR');
};

/**
 * Determine if game is new based on GameTag
 */
const isGameNew = (game) => {
  const tag = (game.GameTag || '').toUpperCase();
  return tag.includes('NEW') || tag.includes('LATEST');
};

/**
 * Transform AdvantPlay game to internal game format
 * Maps API response to match existing game structure
 */
const transformAdvantPlayGame = (game, iconSize = DEFAULT_ICON_SIZE) => {
  const name = getAdvantPlayGameName(game);
  const imageUrl = getAdvantPlayIconUrl(game, iconSize, 'bkg');
  const transparentUrl = getAdvantPlayIconUrl(game, iconSize, 'transparent');

  return {
    // Required fields
    id: `advantplay-${game.GameCode}`,
    gameId: game.GameCode,
    slug: `advantplay-${game.GameCode}`,
    name: name,
    provider: 'AdvantPlay',

    // Images
    image: imageUrl,
    portraitImage: getAdvantPlayIconUrl(game, ADVANTPLAY_ICON_SIZES.PORTRAIT, 'bkg'),
    squareImage: imageUrl,
    transparentImage: transparentUrl,

    // Category and tags
    category: mapAdvantPlayCategory(game.GameCategory),
    rawCategory: Array.isArray(game.GameCategory) ? game.GameCategory.join(',') : (game.GameCategory || null),
    isHot: isGameHot(game),
    isNew: isGameNew(game),
    gameTag: game.GameTag || '',

    // Default game details for modal
    rating: 4.5,
    playCount: Math.floor(Math.random() * 30000) + 5000,
    description: `Experience the thrill of ${name}! This exciting game from AdvantPlay offers amazing gameplay with stunning graphics and big win potential.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols', 'Bonus Round'],

    // AdvantPlay specific
    isAdvantPlay: true,
    originalData: game, // Keep original data for debugging
  };
};

/**
 * Fetch games from AdvantPlay API
 * @param {string} iconSize - Icon size to fetch (default: 200x200)
 */
// Helper function to fetch with timeout (Safari compatibility).
// Overloaded — call as (url, timeout) for catalog GETs, or
// (url, options, timeout) for the transfer-wallet POSTs below.
const fetchWithTimeout = async (url, optionsOrTimeout = {}, maybeTimeout) => {
  const options = typeof optionsOrTimeout === 'object' ? optionsOrTimeout : {};
  const timeout = typeof optionsOrTimeout === 'number'
    ? optionsOrTimeout
    : (typeof maybeTimeout === 'number' ? maybeTimeout : 20000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

/**
 * GET /api/advantplay-transfer/games?size={size}
 *
 * The transfer-wallet catalogue endpoint (doc 2026-06-22 §3.7). Returns
 * AdvantPlay's raw envelope:
 *   { ErrorCode, ErrorDescription, Games: [ { GameCategory, GameCode,
 *     GameTag, IconList:[{ Language, Name, Url:{ size:{bkg,transparent} }}],
 *     Id, ReleaseDate } ] }
 *
 * Each IconList entry that AdvantPlay hasn't shipped art for ships
 * `Url: {}` (empty object). The transform / getAdvantPlayIconUrl below
 * skips those when scoring the language match.
 *
 * The legacy seamless catalogue at /api/advantplay/game/list returns the
 * upstream-404 right now (AdvantPlay disabled the s527 site code on
 * cutover), so we no longer fall back to it.
 */
export const fetchAdvantPlayGames = async (iconSize = DEFAULT_ICON_SIZE) => {
  try {
    const url = `${ADVANTPLAY_TRANSFER_BASE}/games?size=${encodeURIComponent(iconSize)}`;
    console.log('[AdvantPlay/games] → GET', url);
    const response = await fetchWithTimeout(url, 20000);
    if (!response.ok) {
      console.warn('[AdvantPlay/games] HTTP', response.status);
      return { success: false, games: [], error: `HTTP ${response.status}` };
    }
    const data = await response.json().catch(() => null);
    const errorCode = Number(data?.ErrorCode ?? data?.errorCode) || 0;
    if (errorCode !== 0) {
      console.warn('[AdvantPlay/games] upstream errorCode', errorCode);
      return { success: false, games: [], errorCode, error: data?.ErrorDescription };
    }
    const raw = data?.Games || data?.games || [];
    console.log('[AdvantPlay/games] ←', raw.length, 'games');
    return {
      success: true,
      games: raw.map((g) => transformAdvantPlayGame(g, iconSize)),
      rawGames: raw,
    };
  } catch (error) {
    console.error('[AdvantPlay/games] fetch failed:', error);
    return { success: false, games: [], error: error?.message };
  }
};

/**
 * Get all AdvantPlay games with caching
 */
export const getAllAdvantPlayGames = async (iconSize = DEFAULT_ICON_SIZE) => {
  // Return cached data if valid
  if (cachedAdvantPlayGames && advantPlayCacheTimestamp &&
      (Date.now() - advantPlayCacheTimestamp < CACHE_DURATION)) {
    console.log('[AdvantPlayService] Returning cached games');
    return cachedAdvantPlayGames;
  }

  const result = await fetchAdvantPlayGames(iconSize);

  if (result.success && result.games.length > 0) {
    cachedAdvantPlayGames = result.games;
    advantPlayCacheTimestamp = Date.now();
    return result.games;
  }

  return [];
};

/**
 * Clear AdvantPlay games cache
 */
export const clearAdvantPlayCache = () => {
  cachedAdvantPlayGames = null;
  advantPlayCacheTimestamp = null;
};

// ---------------------------------------------------------------------------
// Transfer-wallet operations (POST query-string endpoints under /api/advantplay-transfer/*)
// ---------------------------------------------------------------------------

const ADVANT_ERROR_HINTS = {
  // Per doc §6. Hints are what we surface in toasts — the caller can override.
  5050: 'AdvantPlay is in maintenance — try again shortly.',
  5100: 'AdvantPlay temporary error — try again.',
  5112: 'Session token expired — relaunching.',
  5113: 'Session token expired — relaunching.',
  5121: 'Cash-out is being processed in the background — your balance will update shortly.',
  5201: 'AdvantPlay access restricted from this region.',
  5212: 'Account not initialised on AdvantPlay — retrying.',
  5213: 'Your AdvantPlay account is locked — contact support.',
  5214: 'Your AdvantPlay account has been suspended — contact support.',
  5311: 'AdvantPlay does not permit this action — contact support.',
  5321: 'Insufficient balance. Top up to play.',
};

/**
 * POST /api/advantplay-transfer/launch?accountId&gameCode[&userName&langCode&backUrl&launchLobby]
 *
 * Single-call launch — backend sweeps any leftover balance, deposits the full
 * main wallet (capped at 100k), mints a single-use token, and returns a
 * launchUrl. The launchUrl host is dynamic; never construct it client-side.
 *
 * The caller's `amount` (if any) is intentionally ignored — /launch always
 * sweeps. Use /deposit for partial top-ups mid-session.
 */
export const launchAdvantPlayGame = async (game, accountId, options = {}) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'Please login to play' };

    const gameCode = typeof game === 'object'
      ? (game?.gameCode ?? game?.GameCode ?? game?.gameId)
      : game;
    if (!gameCode) return { success: false, error: 'Missing gameCode' };

    const params = new URLSearchParams({
      accountId,
      gameCode: String(gameCode),
      langCode: options.langCode || DEFAULT_LANG_CODE,
      backUrl: options.backUrl || DEFAULT_BACK_URL,
    });
    if (options.userName) params.set('userName', options.userName);
    if (options.launchLobby) params.set('launchLobby', 'true');

    const url = `${ADVANTPLAY_TRANSFER_BASE}/launch?${params}`;
    console.log('[AdvantPlay/launch] → POST', url);

    const response = await fetchWithTimeout(url, { method: 'POST' });
    const data = await response.json().catch(() => null);
    console.log('[AdvantPlay/launch] ← status', response.status, 'body', data);

    if (!response.ok || !data) {
      return { success: false, error: `Launch failed (HTTP ${response.status})` };
    }

    if (data.success && data.launchUrl) {
      // The launchUrl is single-use + dynamic-host; trim accidental whitespace.
      return {
        success: true,
        gameUrl: String(data.launchUrl).trim(),
        token: data.token,
        depositOpTransferId: data.depositOpTransferId,
        raw: data,
      };
    }

    const code = Number(data.errorCode) || 0;
    return {
      success: false,
      errorCode: code,
      error: ADVANT_ERROR_HINTS[code] || data.errorDescription || 'AdvantPlay temporarily unavailable.',
      // Surfaced for the page so it can warn the player money is sitting on
      // AdvantPlay's side when token minted but URL gen failed (doc §3.1).
      depositOpTransferId: data.depositOpTransferId || null,
      raw: data,
    };
  } catch (error) {
    console.error('[AdvantPlay/launch] error:', error);
    return { success: false, error: error?.message || 'Launch failed' };
  }
};

/**
 * POST /api/advantplay-transfer/exit?accountId
 *
 * Sweep-all + cancel the 20-min auto-withdraw timer. Use on explicit
 * cash-out, on closeGame, and on tab-close cleanup. errorCode 0 with
 * amount > 0 → real cash moved; errorCode 0 with amount 0 → nothing
 * to withdraw; errorCode 5121 → in flight, reconciler will resolve.
 */
export const exitAdvantPlayGame = async (accountId) => {
  try {
    if (!accountId) return { success: false, error: 'No account ID' };
    const url = `${ADVANTPLAY_TRANSFER_BASE}/exit?accountId=${encodeURIComponent(accountId)}`;
    console.log('[AdvantPlay/exit] → POST', url);
    const response = await fetchWithTimeout(url, { method: 'POST' });
    const data = await response.json().catch(() => null);
    console.log('[AdvantPlay/exit] ← status', response.status, 'body', data);
    if (!response.ok || !data) {
      return { success: false, error: `Exit failed (HTTP ${response.status})` };
    }
    const code = Number(data.errorCode) || 0;
    const amount = Number(data.amount) || 0;
    if (code === 0) {
      return { success: true, amount, balanceBefore: data.balanceBefore, balanceAfter: data.balanceAfter, raw: data };
    }
    if (code === 5121) {
      // In flight — backend reconciler will resolve within ~5 min. Caller
      // shows a soft "processing in background" toast and re-polls /balance.
      return { success: false, reconciling: true, errorCode: code, error: ADVANT_ERROR_HINTS[5121], raw: data };
    }
    return {
      success: false,
      errorCode: code,
      error: ADVANT_ERROR_HINTS[code] || data.errorDescription || 'Cash-out failed',
      raw: data,
    };
  } catch (error) {
    console.error('[AdvantPlay/exit] error:', error);
    return { success: false, error: error?.message || 'Exit failed' };
  }
};

/**
 * POST /api/advantplay-transfer/deposit?accountId&amount — partial top-up.
 * Backend handles the signed move; amount must be positive.
 */
export const depositAdvantPlay = async (accountId, amount) => {
  try {
    if (!accountId) return { success: false, error: 'No account ID' };
    if (!(Number(amount) > 0)) return { success: false, error: 'amount must be > 0' };
    const params = new URLSearchParams({ accountId, amount: String(amount) });
    const url = `${ADVANTPLAY_TRANSFER_BASE}/deposit?${params}`;
    const response = await fetchWithTimeout(url, { method: 'POST' });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      return { success: false, error: `Deposit failed (HTTP ${response.status})` };
    }
    const code = Number(data.errorCode) || 0;
    return code === 0
      ? { success: true, amount: Number(data.amount) || 0, raw: data }
      : { success: false, errorCode: code, error: ADVANT_ERROR_HINTS[code] || data.errorDescription, raw: data };
  } catch (error) {
    return { success: false, error: error?.message || 'Deposit failed' };
  }
};

/**
 * POST /api/advantplay-transfer/withdraw?accountId[&amount]
 *
 * Pull chips back to the main wallet. Omit `amount` for a sweep — but for
 * "end session" prefer /exit so the auto-withdraw timer is cancelled too.
 */
export const withdrawAdvantPlay = async (accountId, amount) => {
  try {
    if (!accountId) return { success: false, error: 'No account ID' };
    const params = new URLSearchParams({ accountId });
    if (amount != null && Number(amount) > 0) params.set('amount', String(amount));
    const url = `${ADVANTPLAY_TRANSFER_BASE}/withdraw?${params}`;
    const response = await fetchWithTimeout(url, { method: 'POST' });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      return { success: false, error: `Withdraw failed (HTTP ${response.status})` };
    }
    const code = Number(data.errorCode) || 0;
    if (code === 0) return { success: true, amount: Number(data.amount) || 0, raw: data };
    if (code === 5121) return { success: false, reconciling: true, errorCode: code, error: ADVANT_ERROR_HINTS[5121], raw: data };
    return { success: false, errorCode: code, error: ADVANT_ERROR_HINTS[code] || data.errorDescription, raw: data };
  } catch (error) {
    return { success: false, error: error?.message || 'Withdraw failed' };
  }
};

/**
 * GET /api/advantplay-transfer/balance?accountId
 * Returns the AdvantPlay-side balance. errorCode 5212 → account hasn't been
 * auto-created yet (no launch has happened), treat as $0.
 */
export const getAdvantPlayBalance = async (accountId) => {
  try {
    if (!accountId) return { success: false, error: 'No account ID', balance: 0 };
    const url = `${ADVANTPLAY_TRANSFER_BASE}/balance?accountId=${encodeURIComponent(accountId)}`;
    const response = await fetchWithTimeout(url);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return { success: false, balance: 0, error: `HTTP ${response.status}` };
    const code = Number(data.errorCode || data.ErrorCode) || 0;
    const balance = Number(data.balance ?? data.Balance) || 0;
    if (code === 0) return { success: true, balance, raw: data };
    if (code === 5212) return { success: true, balance: 0, notProvisioned: true, raw: data };
    return { success: false, errorCode: code, error: data.errorDescription || data.ErrorDescription || 'balance read failed', balance: 0, raw: data };
  } catch (error) {
    return { success: false, balance: 0, error: error?.message };
  }
};

/**
 * GET /api/advantplay-transfer/check?opTransferId  — support-only.
 */
export const checkAdvantPlayTransfer = async (opTransferId) => {
  try {
    if (!opTransferId) return { success: false, error: 'No opTransferId' };
    const url = `${ADVANTPLAY_TRANSFER_BASE}/check?opTransferId=${encodeURIComponent(opTransferId)}`;
    const response = await fetchWithTimeout(url);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return { success: false, error: `HTTP ${response.status}` };
    return data;
  } catch (error) {
    return { success: false, error: error?.message };
  }
};

/**
 * GET /api/advantplay-transfer/domain — diagnostics only. The launchUrl
 * returned by /launch already embeds the current dynamic host.
 */
export const getAdvantPlayDomain = async () => {
  try {
    const response = await fetchWithTimeout(`${ADVANTPLAY_TRANSFER_BASE}/domain`);
    return await response.json().catch(() => null);
  } catch { return null; }
};

/**
 * GET /api/advantplay-transfer/icon-sizes — doc §3.8.
 * Returns the upstream-supported size list (e.g. 66x67, 150x150, …).
 * Falls back to the hardcoded local list on any error.
 */
export const getAdvantPlayIconSizes = async () => {
  try {
    const response = await fetchWithTimeout(`${ADVANTPLAY_TRANSFER_BASE}/icon-sizes`, 10000);
    if (response.ok) {
      const data = await response.json().catch(() => null);
      const sizes = data?.Size || data?.size;
      if (Array.isArray(sizes) && sizes.length > 0) return sizes;
    }
  } catch (error) {
    console.warn('[AdvantPlay/icon-sizes] failed:', error?.message);
  }
  return Object.values(ADVANTPLAY_ICON_SIZES);
};

/**
 * GET /api/advantplay-transfer/health
 * Returns { status, provider, enabled, brandCode, siteCode }.
 */
export const checkAdvantPlayHealth = async () => {
  try {
    const response = await fetchWithTimeout(`${ADVANTPLAY_TRANSFER_BASE}/health`, {}, 8000);
    if (!response.ok) return { success: false, status: 'unhealthy' };
    const data = await response.json().catch(() => null);
    return { success: !!data?.enabled, status: data?.status || 'unknown', raw: data };
  } catch (error) {
    return { success: false, status: 'error', error: error?.message };
  }
};

// Export service object for consistency with gameService
export const advantPlayService = {
  fetchGames: fetchAdvantPlayGames,
  getAllGames: getAllAdvantPlayGames,
  launchGame: launchAdvantPlayGame,
  exitGame: exitAdvantPlayGame,
  deposit: depositAdvantPlay,
  withdraw: withdrawAdvantPlay,
  getBalance: getAdvantPlayBalance,
  checkTransfer: checkAdvantPlayTransfer,
  getDomain: getAdvantPlayDomain,
  getIconSizes: getAdvantPlayIconSizes,
  checkHealth: checkAdvantPlayHealth,
  clearCache: clearAdvantPlayCache,
  ICON_SIZES: ADVANTPLAY_ICON_SIZES,
};

export default advantPlayService;

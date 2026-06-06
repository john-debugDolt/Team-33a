/**
 * Rich88 Transfer Wallet Service
 *
 * Endpoints:
 *   GET  /api/rich88-transfer/games
 *   POST /api/rich88-transfer/launch?accountId=&gameCode=&operator=foc|normal
 *   POST /api/rich88-transfer/withdraw?accountId=&amount=
 *   POST /api/rich88-transfer/exit?accountId=
 *   GET  /api/rich88-transfer/balance?accountId=
 *
 * Multi-operator: when bonus_wallet > 0, launch with ?operator=foc, otherwise
 * default (?operator=normal). Locked-in per player on first launch.
 */

import rich88Logo from '../images/rich88logo.jpg';

const BASE_URL = 'https://seamless.team33.mx';

let cachedGames = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

const fetchWithTimeout = async (url, options = {}, timeout = 20000) => {
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

const FALLBACK_IMAGE = rich88Logo;

const transformGame = (game) => {
  const name = game.game_name_enu || game.game_name_chs || game.game_code || 'Unknown Game';
  const gameCode = game.game_code;
  const rawCat = (game.category || '').toLowerCase();
  let category = 'slot';
  if (rawCat.includes('fish')) category = 'fishing';
  else if (rawCat.includes('table') || rawCat.includes('card')) category = 'card';
  else if (rawCat.includes('arcade')) category = 'arcade';
  else if (rawCat.includes('live')) category = 'live';

  return {
    id: `rich88-${gameCode}`,
    gameId: gameCode,
    gameCode: gameCode,
    slug: `rich88-${gameCode}`,
    name,
    provider: 'Rich88',
    image: game.image || game.thumbnail || FALLBACK_IMAGE,
    portraitImage: game.image || FALLBACK_IMAGE,
    squareImage: game.image || FALLBACK_IMAGE,
    category,
    rawCategory: game.category || game.game_type,
    isHot: false,
    isNew: false,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Experience ${name} from Rich88.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols'],
    isRich88: true,
    providerType: 'transfer',
    originalData: game,
  };
};

export const fetchRich88Games = async () => {
  try {
    const urls = [`${BASE_URL}/api/rich88-transfer/games`, `/api/rich88-transfer/games`];
    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;
        const data = await response.json();
        // Apidoc: { code: 0, msg: "Success", data: [...] }
        if (data.code !== 0 && data.success === false) continue;
        const list = Array.isArray(data?.data) ? data.data
                   : Array.isArray(data?.games) ? data.games
                   : Array.isArray(data) ? data : [];
        const active = list.filter(g => g.is_active !== false);
        if (active.length > 0) {
          console.log('[Rich88Service] Found', active.length, 'active games');
          return active.map(transformGame);
        }
      } catch (err) {
        console.log('[Rich88Service] Error:', err.message);
      }
    }
    return [];
  } catch (error) {
    console.error('[Rich88Service] Failed:', error);
    return [];
  }
};

export const getAllRich88Games = async () => {
  if (cachedGames && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedGames;
  }
  const games = await fetchRich88Games();
  if (games.length > 0) {
    cachedGames = games;
    cacheTimestamp = Date.now();
  }
  return games;
};

export const launchRich88Game = async (game, accountId, lang = 'en-US') => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'Please login to play' };

    const gameCode = typeof game === 'object' ? (game?.gameCode ?? game?.gameId) : game;
    if (!gameCode) return { success: false, error: 'Missing gameCode' };

    const { getAccountType } = await import('./bonusWalletService.js');
    const accountType = await getAccountType(accountId);

    const params = new URLSearchParams({
      accountId,
      gameCode: String(gameCode),
      lang,
      operator: accountType === 'bonus' ? 'foc' : 'normal',
    });

    const urls = [
      `${BASE_URL}/api/rich88-transfer/launch?${params}`,
      `/api/rich88-transfer/launch?${params}`,
    ];
    console.log('[Rich88/launch] accountType=', accountType, 'accountId=', accountId, 'gameCode=', gameCode);

    for (const url of urls) {
      try {
        console.log('[Rich88/launch] → POST', url);
        const response = await fetchWithTimeout(url, { method: 'POST' });
        console.log('[Rich88/launch] ← status', response.status, url);
        if (!response.ok) continue;
        const data = await response.json();
        console.log('[Rich88/launch] ← body', data);
        const gameUrl = (data?.data?.url || data?.url || data?.gameUrl)?.trim();
        if (data.code === 0 && gameUrl) {
          return { success: true, gameUrl, ...data };
        }
        if (data.code && data.code !== 0) {
          return { success: false, error: data.msg || 'Launch failed', code: data.code };
        }
      } catch (err) {
        console.log('[Rich88Service] Launch error:', err.message);
      }
    }
    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getRich88Balance = async (accountId) => {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/rich88-transfer/balance?accountId=${accountId}`
    );
    if (!response.ok) return { success: false, balance: 0 };
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const exitRich88 = async (accountId) => {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/rich88-transfer/exit?accountId=${accountId}`,
      { method: 'POST' }
    );
    return await response.json().catch(() => ({ success: response.ok }));
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearRich88Cache = () => { cachedGames = null; cacheTimestamp = null; };

export default {
  fetchGames: fetchRich88Games,
  getAllGames: getAllRich88Games,
  launchGame: launchRich88Game,
  getBalance: getRich88Balance,
  exit: exitRich88,
  clearCache: clearRich88Cache,
};

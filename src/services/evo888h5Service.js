/**
 * EVO888H5 Game Provider Service
 * Handles fetching games and launching games from EVO888H5 provider
 */

// EVO888H5 API Configuration - using seamless backend endpoint
const EVO888H5_API_BASE = '/api/evo888h5';
const EVO888H5_DIRECT_URL = 'https://evo888h5.seamless.team33.mx/api/evo888h5';

/**
 * Fetch with timeout helper for browser compatibility
 */
const fetchWithTimeout = async (url, options = {}, timeout = 20000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

/**
 * Transform EVO888H5 game data to our internal format
 * API Response fields: title, thumbnail, provider, gameid, name, releasedate, weekturnover, monthturnover
 */
const transformEvo888h5Game = (game) => {
  return {
    id: `evo888h5-${game.gameid}`,
    gameId: game.gameid,
    name: game.title || game.name || 'Unknown Game',
    internalName: game.name,
    provider: 'EVO888H5',
    image: game.thumbnail,
    category: 'slot',
    rawCategory: game.gameType || game.category || game.type || 'slot',
    releaseDate: game.releasedate,
    weekTurnover: game.weekturnover || 0,
    monthTurnover: game.monthturnover || 0,
    isEvo888h5: true,
    originalData: game
  };
};

/**
 * Fetch all games from EVO888H5 API
 * Uses the seamless backend endpoint which handles authentication
 */
export const fetchEvo888h5Games = async () => {
  try {
    console.log('[EVO888H5] Fetching games from API...');

    // Try proxy first (for local dev), then direct URL (for production)
    const urls = [
      `${EVO888H5_API_BASE}/games`,
      `${EVO888H5_DIRECT_URL}/games`
    ];

    for (const url of urls) {
      try {
        console.log('[EVO888H5] Trying:', url);
        const response = await fetchWithTimeout(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }, 20000);

        if (!response.ok) {
          console.log('[EVO888H5] Response not OK:', response.status);
          continue;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('[EVO888H5] Non-JSON response:', text.substring(0, 200));
          continue;
        }

        const data = await response.json();
        console.log('[EVO888H5] Raw API response:', data);

        // Response format: { success: true, games: [...], count: 162, message: "OK" }
        if (!data.success) {
          console.log('[EVO888H5] API returned unsuccessful:', data.message);
          continue;
        }

        const games = data.games || [];
        console.log(`[EVO888H5] Found ${games.length} games`);

        return games.map(transformEvo888h5Game);
      } catch (err) {
        console.log('[EVO888H5] Error fetching from', url, ':', err.message);
      }
    }

    console.error('[EVO888H5] All API endpoints failed');
    return [];
  } catch (error) {
    console.error('[EVO888H5] Failed to fetch games:', error.message);
    return [];
  }
};

/**
 * Get all EVO888H5 games (wrapper with caching potential)
 */
export const getAllEvo888h5Games = async () => {
  return fetchEvo888h5Games();
};

/**
 * Launch an EVO888H5 game
 * @param {string} accountId - The player's account ID
 * @param {string} gameId - The game ID to launch (gameid from game list)
 * @param {string} lang - Language code (default: 'en')
 * @returns {Promise<string>} - The game launch URL
 */
export const launchEvo888h5Game = async (accountId, gameId, lang = 'en') => {
  try {
    // Multi-operator routing — EVO888H5 bonus path is a completely separate
    // REST surface (/api/evo888h5-bonus-transfer/*), uses POST with a JSON body
    // (accountId, gameid, language, requestId), and an X-Request-Id header for
    // idempotency. Normal path stays GET on /api/evo888h5/* with query params.
    const { getAccountType } = await import('./bonusWalletService.js');
    const accountType = await getAccountType(accountId);
    const isBonus = accountType === 'bonus';
    console.log('[EVO888H5/launch] accountType=', accountType, 'accountId=', accountId, 'gameId=', gameId);

    if (isBonus) {
      const requestId = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const body = JSON.stringify({ accountId, gameid: String(gameId), language: lang, requestId });
      const urls = [
        `/api/evo888h5-bonus-transfer/launch`,
        `https://seamless.team33.mx/api/evo888h5-bonus-transfer/launch`,
      ];
      for (const launchUrl of urls) {
        try {
          console.log('[EVO888H5/launch] → POST', launchUrl, 'body=', body);
          const response = await fetchWithTimeout(launchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Request-Id': requestId,
            },
            body,
          }, 20000);
          console.log('[EVO888H5/launch] ← status', response.status, launchUrl);
          if (!response.ok) continue;
          const data = await response.json();
          console.log('[EVO888H5/launch] ← body', data);
          // Bonus endpoint: { state: "OK", code: 0, url, depositedAmount, depositSessionId }
          const ok = data.success === true || data.state === 'OK' || data.code === 0;
          const gameUrl = (data.url || data.gameUrl || data.data?.url)?.trim();
          if (ok && gameUrl) {
            // Transfer wallet — record the deposited amount so on return we
            // sweep a withdraw back to the bonus ledger.
            try {
              const { recordLaunch, ProviderKey } = await import('./launchTracker.js');
              recordLaunch(ProviderKey.EVO888H5_BONUS, accountId, {
                amount: data.depositedAmount,
                sessionId: data.depositSessionId,
              });
            } catch (e) { console.log('[EVO888H5/launch] record failed:', e?.message); }
            return gameUrl;
          }
        } catch (err) {
          console.log('[EVO888H5/launch] error:', err.message);
        }
      }
      throw new Error('Failed to launch EVO888H5 bonus game');
    }

    // Normal (real-money) path — GET with query params, original endpoint
    const query = `accountId=${encodeURIComponent(accountId)}&gameId=${encodeURIComponent(gameId)}&lang=${encodeURIComponent(lang)}`;
    const urls = [
      `${EVO888H5_API_BASE}/launch?${query}`,
      `${EVO888H5_DIRECT_URL}/launch?${query}`,
    ];
    for (const launchUrl of urls) {
      try {
        console.log('[EVO888H5/launch] → GET', launchUrl);
        const response = await fetchWithTimeout(launchUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } }, 20000);
        console.log('[EVO888H5/launch] ← status', response.status, launchUrl);
        if (!response.ok) continue;
        const data = await response.json();
        console.log('[EVO888H5/launch] ← body', data);
        if (!data.success) continue;
        return data.gameUrl?.trim();
      } catch (err) {
        console.log('[EVO888H5/launch] error:', err.message);
      }
    }
    throw new Error('Failed to launch EVO888H5 game');
  } catch (error) {
    console.error('[EVO888H5] Failed to launch game:', error.message);
    throw error;
  }
};

/**
 * Withdraw EVO bonus session back to the bonus ledger.
 * POST /api/evo888h5-bonus-transfer/withdraw?accountId=&amount=&requestId=
 * Response: { state: "CONFIRMED" | "RECONCILING" | "FAILED", code, message,
 *             sessionId, direction:"WITHDRAW", amount }
 * Amount is rounded to a whole integer (EVO only takes integers).
 */
export const withdrawEvo888h5Bonus = async (accountId, amount) => {
  try {
    if (!accountId || amount == null) return { success: false, error: 'Missing accountId or amount' };
    const requestId = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const intAmount = Math.max(0, Math.round(Number(amount)));
    const params = new URLSearchParams({ accountId, amount: String(intAmount), requestId });
    const urls = [
      `/api/evo888h5-bonus-transfer/withdraw?${params}`,
      `https://seamless.team33.mx/api/evo888h5-bonus-transfer/withdraw?${params}`,
    ];
    console.log('[EVO888H5/withdraw] accountId=', accountId, 'amount=', intAmount);
    for (const url of urls) {
      try {
        console.log('[EVO888H5/withdraw] → POST', url);
        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'X-Request-Id': requestId },
        }, 20000);
        console.log('[EVO888H5/withdraw] ← status', response.status);
        if (!response.ok) continue;
        const data = await response.json();
        console.log('[EVO888H5/withdraw] ← body', data);
        const ok = data.state === 'CONFIRMED' || data.state === 'RECONCILING';
        return { success: ok, state: data.state, ...data };
      } catch (err) {
        console.log('[EVO888H5/withdraw] error:', err.message);
      }
    }
    return { success: false, error: 'Withdraw failed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  fetchEvo888h5Games,
  getAllEvo888h5Games,
  launchEvo888h5Game,
  withdrawEvo888h5Bonus,
};

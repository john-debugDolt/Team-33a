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
 * Launch an EVO888H5 game.
 *
 * Bonus and production are different products with different REST surfaces:
 *   - bonus      : POST /api/evo888h5-bonus-transfer/launch  (JSON body, integer amounts)
 *   - production : GET  /api/evo888h5/launch                (query params)
 *
 * Bonus body fields (per the integration guide):
 *   accountId  required
 *   gameid     required — the EVO game id (string)
 *   language   optional — "en" | "zh" | "ms" (defaults to server config)
 *   amount     optional — null/omitted ⇒ sweep full bonus_wallet (capped at
 *              maxTransferAmount); >0 ⇒ use this exact amount (HALF_UP
 *              rounded server-side); 0 ⇒ skip deposit (resume scenario)
 *   requestId  optional — idempotency key (X-Request-Id header is the fallback)
 *
 * @param {string} accountId
 * @param {string} gameId
 * @param {string} [lang='en']
 * @param {object} [options] - { amount: number | null }
 * @returns {Promise<string>} the game launch URL
 */
export const launchEvo888h5Game = async (accountId, gameId, lang = 'en', options = {}) => {
  try {
    const { getAccountType } = await import('./bonusWalletService.js');
    const accountType = await getAccountType(accountId);
    const isBonus = accountType === 'bonus';
    console.log('[EVO888H5/launch] accountType=', accountType, 'accountId=', accountId, 'gameId=', gameId);

    if (isBonus) {
      const requestId = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const bodyObj = {
        accountId,
        gameid: String(gameId),
        language: lang,
        requestId,
      };
      // amount: only include when the caller is opinionated. Omit for the
      // default "sweep full bonus_wallet" behavior. Pass 0 to skip the
      // deposit entirely (useful for resuming an active session).
      if (options.amount === 0) bodyObj.amount = 0;
      else if (typeof options.amount === 'number' && options.amount > 0) {
        // EVO only accepts whole units — round to integer client-side so
        // the server doesn't have to.
        bodyObj.amount = Math.round(options.amount);
      }
      const body = JSON.stringify(bodyObj);
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
          // Success: { state: "OK", code: 0, url, depositedAmount, depositSessionId }
          // DEPOSIT_FAILED: { state: "DEPOSIT_FAILED", code, message, depositSessionId }
          const ok = data.state === 'OK' || data.code === 0 || data.success === true;
          const gameUrl = (data.url || data.gameUrl || data.data?.url)?.trim();
          if (ok && gameUrl) {
            // Record a launchTracker entry — the return-sweep posts /exit
            // (NOT /withdraw with the deposited amount): exit asks EVO for
            // the current bonus-side balance and sweeps whatever's actually
            // there, which is what you want when the player has played down.
            // sessionStorage:evo-bonus:active=accountId per the doc.
            try {
              const { recordLaunch, ProviderKey } = await import('./launchTracker.js');
              recordLaunch(ProviderKey.EVO888H5_BONUS, accountId, {
                amount: data.depositedAmount,
                sessionId: data.depositSessionId,
              });
            } catch (e) { console.log('[EVO888H5/launch] record failed:', e?.message); }
            try { sessionStorage.setItem('evo-bonus:active', accountId); } catch { /* ignore */ }
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

const newRequestId = () =>
  (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const BONUS_PATHS = [
  '/api/evo888h5-bonus-transfer',
  'https://seamless.team33.mx/api/evo888h5-bonus-transfer',
];

/**
 * GET /balance — current EVO-side bonus balance.
 * Response: { accountId, balance, evoUserId, currency }
 */
export const getEvo888h5BonusBalance = async (accountId) => {
  try {
    if (!accountId) return { success: false, error: 'Missing accountId' };
    const params = new URLSearchParams({ accountId });
    for (const base of BONUS_PATHS) {
      try {
        const response = await fetchWithTimeout(`${base}/balance?${params}`, {
          headers: { 'X-Request-Id': newRequestId() },
        }, 15000);
        if (!response.ok) continue;
        const data = await response.json();
        return { success: true, ...data };
      } catch { /* try next */ }
    }
    return { success: false, balance: 0 };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /deposit?accountId=&amount=&requestId= — top-up mid-session.
 * EVO accepts whole units only — we floor here defensively so a caller
 * passing 50.6 doesn't end up with an over-quote that EVO rejects.
 */
export const depositToEvo888h5Bonus = async (accountId, amount) => {
  try {
    if (!accountId) return { success: false, error: 'Missing accountId' };
    if (!(Number(amount) > 0)) return { success: false, error: 'amount must be > 0' };
    const requestId = newRequestId();
    const intAmount = Math.floor(Number(amount));
    const params = new URLSearchParams({ accountId, amount: String(intAmount), requestId });
    console.log('[EVO888H5/deposit] accountId=', accountId, 'amount=', intAmount);
    for (const base of BONUS_PATHS) {
      try {
        const response = await fetchWithTimeout(`${base}/deposit?${params}`, {
          method: 'POST',
          headers: { 'X-Request-Id': requestId },
        }, 20000);
        if (!response.ok) continue;
        const data = await response.json();
        console.log('[EVO888H5/deposit] ←', data);
        const ok = data.state === 'CONFIRMED' || data.code === 0;
        return { success: ok, ...data };
      } catch (err) {
        console.log('[EVO888H5/deposit] error:', err.message);
      }
    }
    return { success: false, error: 'Deposit failed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /withdraw?accountId=&amount=&requestId= — partial withdraw mid-session.
 *
 * Per the integration guide §2: the caller must round to integer client-side
 * AND must not ask for more than EVO actually holds. We floor here to be
 * safe; if the caller wants a specific integer they should pass it directly.
 */
export const withdrawEvo888h5Bonus = async (accountId, amount) => {
  try {
    if (!accountId || amount == null) return { success: false, error: 'Missing accountId or amount' };
    const intAmount = Math.max(0, Math.floor(Number(amount)));
    if (intAmount <= 0) return { success: false, error: 'amount must be ≥ 1 (EVO accepts integers only)' };
    const requestId = newRequestId();
    const params = new URLSearchParams({ accountId, amount: String(intAmount), requestId });
    console.log('[EVO888H5/withdraw] accountId=', accountId, 'amount=', intAmount);
    for (const base of BONUS_PATHS) {
      try {
        const response = await fetchWithTimeout(`${base}/withdraw?${params}`, {
          method: 'POST',
          headers: { 'X-Request-Id': requestId },
        }, 20000);
        if (!response.ok) continue;
        const data = await response.json();
        console.log('[EVO888H5/withdraw] ←', data);
        const ok = data.state === 'CONFIRMED' || data.state === 'RECONCILING';
        return { success: ok, ...data };
      } catch (err) {
        console.log('[EVO888H5/withdraw] error:', err.message);
      }
    }
    return { success: false, error: 'Withdraw failed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /exit?accountId= — end the session.
 *
 * Cancels pending auto-withdraw, asks EVO for current bonus-side balance,
 * sweeps via HALF_UP-rounded /user/withdraw. Per the integration guide §4.4,
 * when EVO holds a fractional balance (e.g. 96.7) the HALF_UP round produces
 * an over-quote (97) that EVO rejects with code 112 and the saga lands in
 * RECONCILING. We follow the doc's recommended recovery: read /balance and
 * fire a /withdraw with floor(balance) so the integer portion is recovered
 * immediately; the sub-1 dust stays parked on EVO until next top-up + play.
 *
 * Side-effect: clears sessionStorage:evo-bonus:active on a clean exit.
 */
export const exitEvo888h5Bonus = async (accountId) => {
  try {
    if (!accountId) return { success: false, error: 'Missing accountId' };
    const requestId = newRequestId();
    const params = new URLSearchParams({ accountId });
    console.log('[EVO888H5/exit] accountId=', accountId);
    let exitData = null;
    for (const base of BONUS_PATHS) {
      try {
        const response = await fetchWithTimeout(`${base}/exit?${params}`, {
          method: 'POST',
          headers: { 'X-Request-Id': requestId },
        }, 20000);
        if (!response.ok) continue;
        exitData = await response.json();
        console.log('[EVO888H5/exit] ←', exitData);
        break;
      } catch (err) {
        console.log('[EVO888H5/exit] error:', err.message);
      }
    }
    if (!exitData) return { success: false, error: 'Exit failed' };

    if (exitData.state === 'CONFIRMED') {
      try { sessionStorage.removeItem('evo-bonus:active'); } catch { /* ignore */ }
      return { success: true, ...exitData };
    }

    // RECONCILING + code 112 = HALF_UP overshoot. Read live balance and
    // recover the integer floor with a separate /withdraw.
    if (exitData.state === 'RECONCILING' && exitData.code === 112) {
      console.log('[EVO888H5/exit] reconciling — fetching live balance for floor-withdraw');
      const bal = await getEvo888h5BonusBalance(accountId);
      const floorAmount = Math.floor(Number(bal?.balance) || 0);
      if (floorAmount > 0) {
        const recover = await withdrawEvo888h5Bonus(accountId, floorAmount);
        console.log('[EVO888H5/exit] floor-withdraw outcome:', recover?.state, recover?.amount);
        return {
          success: recover?.success,
          state: recover?.state,
          recoveredAmount: recover?.amount,
          originalExit: exitData,
        };
      }
      // No integer portion left; sub-unit dust stays on EVO until next play.
      return { success: true, state: 'RECONCILING', dustOnly: true, ...exitData };
    }

    return { success: false, ...exitData };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  fetchEvo888h5Games,
  getAllEvo888h5Games,
  launchEvo888h5Game,
  getBalance: getEvo888h5BonusBalance,
  deposit: depositToEvo888h5Bonus,
  withdraw: withdrawEvo888h5Bonus,
  exit: exitEvo888h5Bonus,
};

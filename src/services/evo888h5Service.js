/**
 * EVO888H5 Game Provider Service
 * Handles fetching games and launching games from EVO888H5 provider
 */

// EVO888H5 API Configuration
const EVO888H5_GAME_LIST_URL = 'https://api.evo888h5.com/game/list';
const EVO888H5_BEARER_TOKEN = '615b18639ac74b45aef60182d19f5c1d';
const EVO888H5_LAUNCH_BASE = '/api/evo888h5';

/**
 * Fetch with timeout helper for browser compatibility
 */
const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
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
    releaseDate: game.releasedate,
    weekTurnover: game.weekturnover || 0,
    monthTurnover: game.monthturnover || 0,
    isEvo888h5: true,
    originalData: game
  };
};

/**
 * Fetch all games from EVO888H5 API
 * Requires Bearer token authentication
 */
export const fetchEvo888h5Games = async () => {
  try {
    console.log('[EVO888H5] Fetching games from API...');

    const response = await fetchWithTimeout(
      EVO888H5_GAME_LIST_URL,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${EVO888H5_BEARER_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      },
      15000
    );

    if (!response.ok) {
      throw new Error(`EVO888H5 API error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[EVO888H5] Non-JSON response:', text.substring(0, 200));
      throw new Error('EVO888H5 API returned non-JSON response');
    }

    const data = await response.json();
    console.log('[EVO888H5] Raw API response:', data);

    // Response format: { code: 0, message: "OK", data: [...games] }
    if (data.code !== 0) {
      throw new Error(`EVO888H5 API error: ${data.message}`);
    }

    const games = data.data || [];
    console.log(`[EVO888H5] Found ${games.length} games`);

    return games.map(transformEvo888h5Game);
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
    const launchUrl = `${EVO888H5_LAUNCH_BASE}/launch?accountId=${encodeURIComponent(accountId)}&gameId=${encodeURIComponent(gameId)}&lang=${encodeURIComponent(lang)}`;

    console.log('[EVO888H5] Launching game:', { accountId, gameId, lang, launchUrl });

    const response = await fetchWithTimeout(launchUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }, 15000);

    if (!response.ok) {
      throw new Error(`Failed to launch EVO888H5 game: ${response.status}`);
    }

    const data = await response.json();
    console.log('[EVO888H5] Launch response:', data);

    // Response format: { success: true, gameUrl: "...", message: "OK" }
    if (!data.success) {
      throw new Error(data.message || 'Failed to launch game');
    }

    return data.gameUrl;
  } catch (error) {
    console.error('[EVO888H5] Failed to launch game:', error.message);
    throw error;
  }
};

export default {
  fetchEvo888h5Games,
  getAllEvo888h5Games,
  launchEvo888h5Game
};

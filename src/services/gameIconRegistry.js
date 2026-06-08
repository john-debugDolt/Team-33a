/**
 * Game Icon Registry
 *
 * Resolves a per-game thumbnail from src/images/game_icons/<provider>/<game>.jpg
 * for providers whose upstream catalogue ships no thumbnail field.
 *
 * Vite eagerly imports every file under src/images/game_icons/** at build
 * time, hashes the asset, and gives us back a URL we can render directly.
 * Lookup is name-based: we strip everything that isn't alphanumeric and
 * lowercase, so "100 PokDeng" and "100_pokdeng" both resolve to the same
 * `100pokdeng` key.
 */

const ICON_MODULES = import.meta.glob('../images/game_icons/**/*.{jpg,jpeg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '');

// Provider key (lowercase, alphanumeric) -> Map<normalizedGameName, iconUrl>
const REGISTRY = new Map();

for (const [path, url] of Object.entries(ICON_MODULES)) {
  // path: '../images/game_icons/RiCH88/Slot 777.jpg'
  const parts = path.split('/');
  const folder = parts[parts.length - 2];
  const file = parts[parts.length - 1];
  const baseName = file.replace(/\.(jpg|jpeg|png)$/i, '');

  const providerKey = normalize(folder);
  if (!REGISTRY.has(providerKey)) REGISTRY.set(providerKey, new Map());
  REGISTRY.get(providerKey).set(normalize(baseName), url);
}

/**
 * Resolve a thumbnail URL for the given (provider, gameName). Returns null
 * when no match is found — caller should fall back to its existing logic.
 *
 * @param {string} provider e.g. 'RiCH88', 'rich88', 'Funta Gaming'
 * @param {string} gameName e.g. '100 PokDeng', 'Slot 777'
 */
export const getGameIcon = (provider, gameName) => {
  if (!provider || !gameName) return null;
  const providerKey = normalize(provider);
  const games = REGISTRY.get(providerKey);
  if (!games) return null;
  const direct = games.get(normalize(gameName));
  if (direct) return direct;
  return null;
};

/**
 * Pull every icon URL we have for a provider, in insertion order. Used when
 * the upstream catalogue can't be matched per-game so we want a deterministic
 * image pool to borrow from (similar to the ClotPlay-image-borrow pattern
 * other transfer-wallet providers use).
 */
export const getProviderIconPool = (provider) => {
  const providerKey = normalize(provider);
  const games = REGISTRY.get(providerKey);
  return games ? Array.from(games.values()) : [];
};

/**
 * Pick a deterministic icon from the provider pool for a game that doesn't
 * have an exact-name match — hashes (provider + gameId) so the same game
 * keeps the same fallback image across renders/sessions.
 */
export const pickProviderIcon = (provider, gameId) => {
  const pool = getProviderIconPool(provider);
  if (pool.length === 0) return null;
  const idStr = String(gameId ?? '');
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) hash = (hash * 31 + idStr.charCodeAt(i)) | 0;
  return pool[Math.abs(hash) % pool.length];
};

export default { getGameIcon, getProviderIconPool, pickProviderIcon };

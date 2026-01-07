import db from '../config/db.js';
import { createResponse, getPagination } from '../utils/helpers.js';

// Helper to format game from DB row
const formatGame = (row) => ({
  id: row.id,
  name: row.name,
  provider: row.provider,
  gameType: row.game_type,
  image: row.image,
  rtp: row.rtp,
  minBet: row.min_bet,
  maxBet: row.max_bet,
  volatility: row.volatility,
  isHot: row.is_hot === 1,
  isNew: row.is_new === 1,
  isFeatured: row.is_featured === 1,
  features: JSON.parse(row.features || '[]'),
  rating: row.rating,
  playCount: row.play_count,
  createdAt: row.created_at
});

// @desc    Get all games with filters
// @route   GET /api/games
// @access  Public
export const getGames = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 36,
      provider,
      gameType,
      search,
      isHot,
      isNew,
      isFeatured
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Build query with parameterized placeholders
    let query = 'SELECT * FROM games WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as count FROM games WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (provider && provider !== 'ALL') {
      query += ` AND provider = $${paramIndex}`;
      countQuery += ` AND provider = $${paramIndex}`;
      params.push(provider);
      paramIndex++;
    }

    if (gameType) {
      query += ` AND game_type = $${paramIndex}`;
      countQuery += ` AND game_type = $${paramIndex}`;
      params.push(gameType);
      paramIndex++;
    }

    if (isHot === 'true') {
      query += ' AND is_hot = 1';
      countQuery += ' AND is_hot = 1';
    }

    if (isNew === 'true') {
      query += ' AND is_new = 1';
      countQuery += ' AND is_new = 1';
    }

    if (isFeatured === 'true') {
      query += ' AND is_featured = 1';
      countQuery += ' AND is_featured = 1';
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR provider ILIKE $${paramIndex + 1})`;
      countQuery += ` AND (name ILIKE $${paramIndex} OR provider ILIKE $${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    // Get total count
    const countResult = await db.queryOne(countQuery, params);
    const total = parseInt(countResult.count);

    // Add sorting and pagination
    query += ` ORDER BY is_featured DESC, is_hot DESC, play_count DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, (pageNum - 1) * limitNum);

    const result = await db.queryAll(query, params);
    const games = result.map(formatGame);

    res.json(
      createResponse(true, {
        games,
        pagination: getPagination(pageNum, limitNum, total)
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get single game
// @route   GET /api/games/:id
// @access  Public
export const getGameById = async (req, res) => {
  try {
    const game = await db.queryOne('SELECT * FROM games WHERE id = $1', [req.params.id]);

    if (!game) {
      return res.status(404).json(
        createResponse(false, null, 'Game not found')
      );
    }

    res.json(
      createResponse(true, { game: formatGame(game) })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get featured games
// @route   GET /api/games/featured
// @access  Public
export const getFeaturedGames = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const games = await db.queryAll(`
      SELECT * FROM games WHERE is_featured = 1
      ORDER BY play_count DESC LIMIT $1
    `, [limit]);

    res.json(
      createResponse(true, { games: games.map(formatGame) })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get hot games
// @route   GET /api/games/hot
// @access  Public
export const getHotGames = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const games = await db.queryAll(`
      SELECT * FROM games WHERE is_hot = 1
      ORDER BY play_count DESC LIMIT $1
    `, [limit]);

    res.json(
      createResponse(true, { games: games.map(formatGame) })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get new games
// @route   GET /api/games/new
// @access  Public
export const getNewGames = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const games = await db.queryAll(`
      SELECT * FROM games WHERE is_new = 1
      ORDER BY created_at DESC LIMIT $1
    `, [limit]);

    res.json(
      createResponse(true, { games: games.map(formatGame) })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get all providers
// @route   GET /api/games/providers
// @access  Public
export const getProviders = async (req, res) => {
  try {
    const providers = await db.queryAll(`
      SELECT provider, COUNT(*) as game_count
      FROM games
      GROUP BY provider
      ORDER BY provider
    `);

    const totalResult = await db.queryOne('SELECT COUNT(*) as count FROM games');
    const totalGames = parseInt(totalResult.count);

    const providerList = [
      { id: 'ALL', name: 'ALL', gameCount: totalGames },
      ...providers.map(p => ({
        id: p.provider,
        name: p.provider,
        gameCount: parseInt(p.game_count)
      }))
    ];

    res.json(
      createResponse(true, { providers: providerList })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Increment play count
// @route   POST /api/games/:id/play
// @access  Public
export const incrementPlayCount = async (req, res) => {
  try {
    const result = await db.query('UPDATE games SET play_count = play_count + 1 WHERE id = $1', [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json(
        createResponse(false, null, 'Game not found')
      );
    }

    const game = await db.queryOne('SELECT play_count FROM games WHERE id = $1', [req.params.id]);

    res.json(
      createResponse(true, { playCount: game.play_count })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

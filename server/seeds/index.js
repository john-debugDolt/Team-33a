import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import db from '../config/db.js';
import { gamesData } from './gamesData.js';
import { promotionsData } from './promotionsData.js';

dotenv.config();

const generateId = () => crypto.randomUUID();

const seedAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
    if (existingAdmin) {
      console.log('Admin already exists, skipping...');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', salt);

    const adminId = generateId();
    const now = new Date().toISOString();
    const permissions = JSON.stringify([
      'manage_users',
      'manage_games',
      'manage_promotions',
      'manage_transactions',
      'view_reports',
      'manage_admins'
    ]);

    db.prepare(`
      INSERT INTO admins (id, username, email, password_hash, role, permissions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      adminId,
      process.env.ADMIN_USERNAME || 'admin',
      process.env.ADMIN_EMAIL || 'admin@team33.com',
      passwordHash,
      'superadmin',
      permissions,
      now
    );

    console.log(`Admin created: ${process.env.ADMIN_USERNAME || 'admin'}`);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

const seedGames = () => {
  try {
    // Check if games already exist
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM games').get().count;
    if (existingCount > 0) {
      console.log(`${existingCount} games already exist, skipping...`);
      return;
    }

    const insertStmt = db.prepare(`
      INSERT INTO games (id, name, provider, game_type, image, rtp, min_bet, max_bet, volatility, is_hot, is_new, is_featured, features, rating, play_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    const insertMany = db.transaction((games) => {
      for (const game of games) {
        insertStmt.run(
          generateId(),
          game.name,
          game.provider,
          game.gameType,
          game.image,
          game.rtp,
          game.minBet,
          game.maxBet,
          game.volatility,
          game.isHot ? 1 : 0,
          game.isNew ? 1 : 0,
          game.isFeatured ? 1 : 0,
          JSON.stringify(game.features),
          game.rating,
          game.playCount,
          now
        );
      }
    });

    insertMany(gamesData);
    console.log(`${gamesData.length} games seeded`);
  } catch (error) {
    console.error('Error seeding games:', error.message);
  }
};

const seedPromotions = () => {
  try {
    // Check if promotions already exist
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM promotions').get().count;
    if (existingCount > 0) {
      console.log(`${existingCount} promotions already exist, skipping...`);
      return;
    }

    const insertStmt = db.prepare(`
      INSERT INTO promotions (id, title, subtitle, description, image, category, bonus_type, bonus_amount, max_bonus, min_deposit, wagering_requirement, valid_from, valid_until, terms, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    const insertMany = db.transaction((promotions) => {
      for (const promo of promotions) {
        insertStmt.run(
          generateId(),
          promo.title,
          promo.subtitle,
          promo.description,
          promo.image,
          promo.category,
          promo.bonusType || null,
          promo.bonusAmount,
          promo.maxBonus,
          promo.minDeposit,
          promo.wageringRequirement,
          promo.validFrom instanceof Date ? promo.validFrom.toISOString() : promo.validFrom,
          promo.validUntil instanceof Date ? promo.validUntil.toISOString() : promo.validUntil,
          JSON.stringify(promo.terms),
          promo.isActive ? 1 : 0,
          now
        );
      }
    });

    insertMany(promotionsData);
    console.log(`${promotionsData.length} promotions seeded`);
  } catch (error) {
    console.error('Error seeding promotions:', error.message);
  }
};

const runSeeds = async () => {
  console.log('Starting database seeding...\n');

  await seedAdmin();
  seedGames();
  seedPromotions();

  console.log('\nSeeding complete!');
  process.exit(0);
};

runSeeds();

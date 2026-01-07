import db from './config/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const generateId = () => crypto.randomBytes(12).toString('hex');

// Use a relative path that will work with the frontend build
const gameIcon = '/Game icon .png';

const games = [
  { name: 'Golden Fortune', provider: 'JILI', isHot: true, isNew: false, isFeatured: true },
  { name: 'Lucky Spin', provider: 'JILI', isHot: true, isNew: false, isFeatured: false },
  { name: 'Dragon Treasure', provider: 'PG', isHot: false, isNew: true, isFeatured: true },
  { name: 'Mega Jackpot', provider: 'PG', isHot: true, isNew: false, isFeatured: false },
  { name: 'Wild Safari', provider: 'PP', isHot: false, isNew: true, isFeatured: false },
  { name: 'Ocean King', provider: 'PP', isHot: true, isNew: false, isFeatured: false },
  { name: 'Fortune Tiger', provider: 'FACHAI', isHot: true, isNew: true, isFeatured: true },
  { name: 'Money Tree', provider: 'FACHAI', isHot: false, isNew: false, isFeatured: false },
  { name: 'Super Ace', provider: 'JILI', isHot: true, isNew: false, isFeatured: false },
  { name: 'Boxing King', provider: 'JILI', isHot: false, isNew: true, isFeatured: false },
  { name: 'Crazy 777', provider: 'CQ9', isHot: true, isNew: false, isFeatured: false },
  { name: 'Golden Empire', provider: 'CQ9', isHot: false, isNew: true, isFeatured: true },
];

const promotions = [
  {
    title: 'Welcome Bonus',
    subtitle: 'Get 100% up to $500',
    description: 'New players get a 100% match bonus on their first deposit up to $500!',
    image: '/promo1.jpg',
    category: 'BONUS',
    bonusType: 'percentage',
    bonusAmount: '100%',
    maxBonus: 500,
    minDeposit: 20,
    wageringRequirement: 35,
    validFrom: '2024-01-01',
    validUntil: '2030-12-31',
    terms: ['Minimum deposit $20', '35x wagering requirement', 'Valid for 30 days'],
    isFeatured: true
  },
  {
    title: 'Weekly Reload',
    subtitle: '50% Reload Bonus',
    description: 'Get 50% bonus on your weekly deposit!',
    image: '/promo2.jpg',
    category: 'SLOTS',
    bonusType: 'percentage',
    bonusAmount: '50%',
    maxBonus: 200,
    minDeposit: 10,
    wageringRequirement: 25,
    validFrom: '2024-01-01',
    validUntil: '2030-12-31',
    terms: ['Minimum deposit $10', '25x wagering requirement', 'Valid every week'],
    isFeatured: false
  }
];

const seedDatabase = async () => {
  try {
    console.log('Initializing database...');
    await db.initDatabase();

    console.log('\nSeeding games...');
    // Clear existing games
    await db.query('DELETE FROM games');
    console.log('Cleared existing games');

    const now = new Date().toISOString();

    for (const game of games) {
      const id = generateId();
      await db.query(`
        INSERT INTO games (id, name, provider, game_type, image, rtp, min_bet, max_bet, volatility, is_hot, is_new, is_featured, features, rating, play_count, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        id,
        game.name,
        game.provider,
        'slot',
        gameIcon,
        96.5,
        0.10,
        100,
        'Medium',
        game.isHot ? 1 : 0,
        game.isNew ? 1 : 0,
        game.isFeatured ? 1 : 0,
        '["Free Spins", "Multipliers"]',
        4.5,
        Math.floor(Math.random() * 10000),
        now
      ]);
      console.log(`Added game: ${game.name}`);
    }
    console.log(`\nSeeded ${games.length} games successfully!`);

    // Seed promotions
    console.log('\nSeeding promotions...');
    await db.query('DELETE FROM promotions');

    for (const promo of promotions) {
      const id = generateId();
      await db.query(`
        INSERT INTO promotions (id, title, subtitle, description, image, category, bonus_type, bonus_amount, max_bonus, min_deposit, wagering_requirement, valid_from, valid_until, terms, is_active, is_featured, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        id,
        promo.title,
        promo.subtitle,
        promo.description,
        promo.image,
        promo.category,
        promo.bonusType,
        promo.bonusAmount,
        promo.maxBonus,
        promo.minDeposit,
        promo.wageringRequirement,
        promo.validFrom,
        promo.validUntil,
        JSON.stringify(promo.terms),
        1,
        promo.isFeatured ? 1 : 0,
        now
      ]);
      console.log(`Added promotion: ${promo.title}`);
    }
    console.log(`\nSeeded ${promotions.length} promotions successfully!`);

    // Seed admin user
    console.log('\nSeeding admin user...');
    const existingAdmin = await db.queryOne('SELECT * FROM admins WHERE username = $1', [process.env.ADMIN_USERNAME || 'admin']);

    if (!existingAdmin) {
      const adminId = generateId();
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', salt);

      await db.query(`
        INSERT INTO admins (id, username, email, password_hash, role, permissions, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        adminId,
        process.env.ADMIN_USERNAME || 'admin',
        process.env.ADMIN_EMAIL || 'admin@team33.com',
        passwordHash,
        'superadmin',
        '["all"]',
        now
      ]);
      console.log('Admin user created successfully!');
    } else {
      console.log('Admin user already exists, skipping...');
    }

    // Seed test users
    console.log('\nSeeding test users...');
    const testUsers = [
      { username: 'player1', email: 'player1@test.com', password: 'password123', balance: 1000 },
      { username: 'player2', email: 'player2@test.com', password: 'password123', balance: 500 },
      { username: 'vipuser', email: 'vip@test.com', password: 'password123', balance: 5000, vipLevel: 'Gold' }
    ];

    for (const user of testUsers) {
      const existingUser = await db.queryOne('SELECT * FROM users WHERE username = $1', [user.username]);
      if (!existingUser) {
        const userId = generateId();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(user.password, salt);

        await db.query(`
          INSERT INTO users (id, username, email, password_hash, balance, available_balance, vip_level, created_at, last_login)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          userId,
          user.username,
          user.email,
          passwordHash,
          user.balance,
          user.balance,
          user.vipLevel || 'Bronze',
          now,
          now
        ]);
        console.log(`Added test user: ${user.username}`);
      }
    }

    console.log('\n✅ Database seeded successfully!');
    console.log('\nTest Accounts:');
    console.log('  Admin: admin / admin123');
    console.log('  Player: player1 / password123');
    console.log('  VIP: vipuser / password123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error.message);
    process.exit(1);
  }
};

// Run the seed
seedDatabase();

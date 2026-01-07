import bcrypt from 'bcryptjs';
import db from './config/db.js';
import crypto from 'crypto';

const generateId = () => crypto.randomBytes(12).toString('hex');

async function createMockUsers() {
  const users = [
    {
      username: 'demo',
      email: 'demo@team33.com',
      phone: '1234567890',
      password: 'demo123',
      balance: 500
    },
    {
      username: 'testuser',
      email: 'test@team33.com',
      phone: '0987654321',
      password: 'test123',
      balance: 1000
    }
  ];

  for (const user of users) {
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(user.username, user.email);
    if (existing) {
      console.log(`User ${user.username} already exists, skipping...`);
      continue;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(user.password, salt);
    const userId = generateId();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, email, phone, password_hash, balance, available_balance, pending_balance, vip_level, created_at, last_login)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, user.username, user.email, user.phone, passwordHash, user.balance, user.balance, 0, 'Bronze', now, now);

    // Add welcome bonus transaction
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, amount, status, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(generateId(), userId, 'bonus', user.balance, 'completed', 'Welcome Bonus', now);

    console.log(`Created user: ${user.username} (password: ${user.password})`);
  }

  console.log('Done!');
}

createMockUsers();

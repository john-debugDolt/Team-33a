import db from '../config/db.js';
import { createResponse, getPagination, CHECKIN_REWARDS, generateId } from '../utils/helpers.js';

// Helper to format transaction from DB row
const formatTransaction = (row) => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  amount: row.amount,
  status: row.status,
  paymentMethod: row.payment_method,
  description: row.description,
  createdAt: row.created_at
});

// @desc    Get user balance
// @route   GET /api/wallet/balance
// @access  Private
export const getBalance = async (req, res) => {
  try {
    res.json(
      createResponse(true, {
        balance: {
          total: req.user.balance,
          available: req.user.availableBalance,
          pending: req.user.pendingBalance
        }
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get transaction history
// @route   GET /api/wallet/transactions
// @access  Private
export const getTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Build query with parameterized placeholders
    let query = 'SELECT * FROM transactions WHERE user_id = $1';
    let countQuery = 'SELECT COUNT(*) as count FROM transactions WHERE user_id = $1';
    const params = [req.user.id];
    let paramIndex = 2;

    if (type && type !== 'all') {
      query += ` AND type = $${paramIndex}`;
      countQuery += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex}`;
      countQuery += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Get total count
    const countResult = await db.queryOne(countQuery, params);
    const total = parseInt(countResult.count);

    // Add sorting and pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, (pageNum - 1) * limitNum);

    const result = await db.queryAll(query, params);
    const transactions = result.map(formatTransaction);

    res.json(
      createResponse(true, {
        transactions,
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

// @desc    Deposit funds
// @route   POST /api/wallet/deposit
// @access  Private
export const deposit = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;

    // Validation
    if (!amount || amount < 10) {
      return res.status(400).json(
        createResponse(false, null, 'Minimum deposit amount is $10')
      );
    }

    if (amount > 10000) {
      return res.status(400).json(
        createResponse(false, null, 'Maximum deposit amount is $10,000')
      );
    }

    const now = new Date().toISOString();
    const transactionId = generateId();

    // Create transaction
    await db.query(`
      INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [transactionId, req.user.id, 'deposit', amount, 'completed', paymentMethod || 'Credit Card', `Deposit via ${paymentMethod || 'Credit Card'}`, now]);

    // Update user balance
    const newAvailable = req.user.availableBalance + amount;
    const newTotal = newAvailable + req.user.pendingBalance;

    await db.query(`
      UPDATE users SET available_balance = $1, balance = $2 WHERE id = $3
    `, [newAvailable, newTotal, req.user.id]);

    const transaction = await db.queryOne('SELECT * FROM transactions WHERE id = $1', [transactionId]);

    res.json(
      createResponse(true, {
        transaction: formatTransaction(transaction),
        balance: {
          total: newTotal,
          available: newAvailable,
          pending: req.user.pendingBalance
        }
      }, `Successfully deposited $${amount}`)
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Withdraw funds
// @route   POST /api/wallet/withdraw
// @access  Private
export const withdraw = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;

    // Validation
    if (!amount || amount < 20) {
      return res.status(400).json(
        createResponse(false, null, 'Minimum withdrawal amount is $20')
      );
    }

    if (amount > req.user.availableBalance) {
      return res.status(400).json(
        createResponse(false, null, 'Insufficient balance')
      );
    }

    const now = new Date().toISOString();
    const transactionId = generateId();

    // Create pending transaction
    await db.query(`
      INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [transactionId, req.user.id, 'withdraw', amount, 'pending', paymentMethod || 'Bank Transfer', `Withdrawal to ${paymentMethod || 'Bank Transfer'}`, now]);

    // Move funds to pending
    const newAvailable = req.user.availableBalance - amount;
    const newPending = req.user.pendingBalance + amount;
    const newTotal = newAvailable + newPending;

    await db.query(`
      UPDATE users SET available_balance = $1, pending_balance = $2, balance = $3 WHERE id = $4
    `, [newAvailable, newPending, newTotal, req.user.id]);

    const transaction = await db.queryOne('SELECT * FROM transactions WHERE id = $1', [transactionId]);

    res.json(
      createResponse(true, {
        transaction: formatTransaction(transaction),
        balance: {
          total: newTotal,
          available: newAvailable,
          pending: newPending
        }
      }, `Withdrawal of $${amount} is pending approval`)
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Transfer funds to another user
// @route   POST /api/wallet/transfer
// @access  Private
export const transfer = async (req, res) => {
  try {
    const { amount, recipientUsername } = req.body;

    // Validation
    if (!amount || amount < 1) {
      return res.status(400).json(
        createResponse(false, null, 'Minimum transfer amount is $1')
      );
    }

    if (amount > req.user.availableBalance) {
      return res.status(400).json(
        createResponse(false, null, 'Insufficient balance')
      );
    }

    // Find recipient
    const recipient = await db.queryOne('SELECT * FROM users WHERE username = $1', [recipientUsername]);

    if (!recipient) {
      return res.status(404).json(
        createResponse(false, null, 'Recipient not found')
      );
    }

    if (recipient.id === req.user.id) {
      return res.status(400).json(
        createResponse(false, null, 'Cannot transfer to yourself')
      );
    }

    const now = new Date().toISOString();

    // Create sender transaction
    await db.query(`
      INSERT INTO transactions (id, user_id, type, amount, status, description, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [generateId(), req.user.id, 'transfer', -amount, 'completed', `Transfer to ${recipient.username}`, now]);

    // Create receiver transaction
    await db.query(`
      INSERT INTO transactions (id, user_id, type, amount, status, description, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [generateId(), recipient.id, 'transfer', amount, 'completed', `Transfer from ${req.user.username}`, now]);

    // Update sender balance
    const newAvailable = req.user.availableBalance - amount;
    const newTotal = newAvailable + req.user.pendingBalance;
    await db.query('UPDATE users SET available_balance = $1, balance = $2 WHERE id = $3', [newAvailable, newTotal, req.user.id]);

    // Update recipient balance
    const recipientNewAvailable = recipient.available_balance + amount;
    const recipientNewTotal = recipientNewAvailable + recipient.pending_balance;
    await db.query('UPDATE users SET available_balance = $1, balance = $2 WHERE id = $3', [recipientNewAvailable, recipientNewTotal, recipient.id]);

    res.json(
      createResponse(true, {
        balance: {
          total: newTotal,
          available: newAvailable,
          pending: req.user.pendingBalance
        }
      }, `Successfully transferred $${amount} to ${recipient.username}`)
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get check-in status
// @route   GET /api/wallet/checkin
// @access  Private
export const getCheckInStatus = async (req, res) => {
  try {
    let checkIn = await db.queryOne('SELECT * FROM checkins WHERE user_id = $1', [req.user.id]);

    if (!checkIn) {
      const checkInId = generateId();
      await db.query(`
        INSERT INTO checkins (id, user_id, checked_days, current_streak)
        VALUES ($1, $2, $3, $4)
      `, [checkInId, req.user.id, '[]', 0]);

      checkIn = await db.queryOne('SELECT * FROM checkins WHERE id = $1', [checkInId]);
    }

    const checkedDays = JSON.parse(checkIn.checked_days || '[]');
    const lastCheckIn = checkIn.last_checkin;
    const currentStreak = checkIn.current_streak;

    // Check if streak should be reset
    let shouldReset = false;
    if (lastCheckIn) {
      const lastDate = new Date(lastCheckIn);
      const now = new Date();
      const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        shouldReset = true;
      }
    }

    if (shouldReset) {
      await db.query('UPDATE checkins SET checked_days = $1, current_streak = $2 WHERE user_id = $3', ['[]', 0, req.user.id]);
    }

    // Can check in if last check-in was not today
    const today = new Date().toDateString();
    const lastCheckInDate = lastCheckIn ? new Date(lastCheckIn).toDateString() : null;
    const isCheckedToday = lastCheckInDate === today;

    const currentDay = shouldReset ? 0 : currentStreak;
    const nextReward = isCheckedToday ? null : CHECKIN_REWARDS[currentDay] || null;

    res.json(
      createResponse(true, {
        checkedDays: shouldReset ? [] : checkedDays,
        lastCheckIn,
        currentStreak: shouldReset ? 0 : currentStreak,
        isCheckedToday,
        currentDay: currentDay + 1,
        nextReward,
        rewards: CHECKIN_REWARDS
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Claim daily check-in
// @route   POST /api/wallet/checkin
// @access  Private
export const checkIn = async (req, res) => {
  try {
    let checkIn = await db.queryOne('SELECT * FROM checkins WHERE user_id = $1', [req.user.id]);

    if (!checkIn) {
      const checkInId = generateId();
      await db.query(`
        INSERT INTO checkins (id, user_id, checked_days, current_streak)
        VALUES ($1, $2, $3, $4)
      `, [checkInId, req.user.id, '[]', 0]);

      checkIn = await db.queryOne('SELECT * FROM checkins WHERE id = $1', [checkInId]);
    }

    let checkedDays = JSON.parse(checkIn.checked_days || '[]');
    let currentStreak = checkIn.current_streak;
    const lastCheckIn = checkIn.last_checkin;

    // Check if already checked in today
    const today = new Date().toDateString();
    const lastCheckInDate = lastCheckIn ? new Date(lastCheckIn).toDateString() : null;
    if (lastCheckInDate === today) {
      return res.status(400).json(
        createResponse(false, null, 'Already checked in today')
      );
    }

    // Reset if missed a day
    if (lastCheckIn) {
      const lastDate = new Date(lastCheckIn);
      const now = new Date();
      const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        checkedDays = [];
        currentStreak = 0;
      }
    }

    // Get reward for current day
    const reward = CHECKIN_REWARDS[currentStreak];

    // Update check-in record
    checkedDays.push(currentStreak + 1);
    currentStreak += 1;

    // Reset after day 7
    if (currentStreak >= 7) {
      checkedDays = [];
      currentStreak = 0;
    }

    const now = new Date().toISOString();
    await db.query(`
      UPDATE checkins SET checked_days = $1, current_streak = $2, last_checkin = $3 WHERE user_id = $4
    `, [JSON.stringify(checkedDays), currentStreak, now, req.user.id]);

    // Add bonus to user
    const newAvailable = req.user.availableBalance + reward;
    const newTotal = newAvailable + req.user.pendingBalance;
    await db.query('UPDATE users SET available_balance = $1, balance = $2 WHERE id = $3', [newAvailable, newTotal, req.user.id]);

    // Create bonus transaction
    await db.query(`
      INSERT INTO transactions (id, user_id, type, amount, status, description, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [generateId(), req.user.id, 'bonus', reward, 'completed', `Daily Check-in Reward (Day ${checkedDays.length || 7})`, now]);

    res.json(
      createResponse(true, {
        reward,
        checkedDays,
        currentStreak,
        balance: {
          total: newTotal,
          available: newAvailable,
          pending: req.user.pendingBalance
        }
      }, `Successfully claimed $${reward} check-in reward!`)
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

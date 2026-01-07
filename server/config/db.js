import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to get file path for a table
const getFilePath = (table) => path.join(DATA_DIR, `${table}.json`);

// Read data from JSON file
const readTable = (table) => {
  const filePath = getFilePath(table);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]');
    return [];
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data || '[]');
};

// Write data to JSON file
const writeTable = (table, data) => {
  const filePath = getFilePath(table);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Extract table name from SQL
const getTableName = (sql) => {
  // Check INSERT INTO first (before FROM, since columns might contain 'from')
  const intoMatch = sql.match(/into\s+(\w+)/i);
  if (intoMatch) return intoMatch[1];

  // Check UPDATE
  const updateMatch = sql.match(/update\s+(\w+)/i);
  if (updateMatch) return updateMatch[1];

  // Check FROM (for SELECT and DELETE)
  const fromMatch = sql.match(/from\s+(\w+)/i);
  if (fromMatch) return fromMatch[1];

  return null;
};

// Database interface
const db = {
  // Generic query
  query: async (sql, params = []) => {
    sql = sql.trim();
    const sqlLower = sql.toLowerCase();

    // Skip CREATE statements
    if (sqlLower.startsWith('create')) {
      return { rows: [], rowCount: 0 };
    }

    const table = getTableName(sql);
    if (!table) return { rows: [], rowCount: 0 };

    let data = readTable(table);

    // Handle DELETE
    if (sqlLower.startsWith('delete')) {
      const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\$1/i);
      if (whereMatch && params[0]) {
        const field = whereMatch[1];
        const originalLen = data.length;
        data = data.filter(row => row[field] !== params[0]);
        writeTable(table, data);
        return { rows: [], rowCount: originalLen - data.length };
      } else {
        // Delete all
        writeTable(table, []);
        return { rows: [], rowCount: data.length };
      }
    }

    // Handle INSERT
    if (sqlLower.startsWith('insert')) {
      const colMatch = sql.match(/\(([^)]+)\)\s*values/i);
      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim());
        const newRow = {};
        cols.forEach((col, i) => {
          newRow[col] = params[i];
        });
        data.push(newRow);
        writeTable(table, data);
        return { rows: [newRow], rowCount: 1 };
      }
      // Fallback for INSERT without successful column match
      return { rows: [], rowCount: 0 };
    }

    // Handle UPDATE
    if (sqlLower.startsWith('update')) {
      // Find WHERE clause
      const whereMatch = sql.match(/where\s+id\s*=\s*\$(\d+)/i);
      let targetId = null;
      if (whereMatch) {
        const paramIdx = parseInt(whereMatch[1]) - 1;
        targetId = params[paramIdx];
      }

      // Find user_id match
      const userIdMatch = sql.match(/where\s+user_id\s*=\s*\$(\d+)/i);
      let targetUserId = null;
      if (userIdMatch) {
        const paramIdx = parseInt(userIdMatch[1]) - 1;
        targetUserId = params[paramIdx];
      }

      let updatedCount = 0;
      data = data.map(row => {
        // Check if this row should be updated
        if (targetId && row.id !== targetId) return row;
        if (targetUserId && row.user_id !== targetUserId) return row;

        // Parse SET clause and update fields
        const setMatch = sql.match(/set\s+(.+?)\s*where/i);
        if (setMatch) {
          const assignments = setMatch[1].split(',');
          assignments.forEach(assign => {
            // Match field = $N or field = COALESCE($N, field)
            const simpleMatch = assign.match(/(\w+)\s*=\s*\$(\d+)/);
            if (simpleMatch) {
              const field = simpleMatch[1].trim();
              const paramIdx = parseInt(simpleMatch[2]) - 1;
              const value = params[paramIdx];

              // Handle COALESCE - only update if value is not null
              if (assign.toLowerCase().includes('coalesce')) {
                if (value !== null && value !== undefined) {
                  row[field] = value;
                }
              } else {
                row[field] = value;
              }
            }
          });
          updatedCount++;
        }
        return row;
      });

      writeTable(table, data);
      return { rows: [], rowCount: updatedCount };
    }

    // Handle SELECT
    if (sqlLower.startsWith('select')) {
      let results = [...data];

      // Handle JOIN (simplified)
      const joinMatch = sql.match(/left\s+join\s+(\w+)\s+(\w+)\s+on/i);
      if (joinMatch) {
        const joinTable = joinMatch[1];
        const joinData = readTable(joinTable);

        results = results.map(row => {
          const joinRow = joinData.find(j => j.id === row.user_id) || {};
          return { ...row, username: joinRow.username, email: joinRow.email };
        });
      }

      // Handle WHERE conditions
      if (sql.toLowerCase().includes('where')) {
        results = results.filter(row => {
          let match = true;

          // Find all $N parameters in WHERE clause
          const whereClause = sql.match(/where\s+(.+?)(?:\s+order|\s+limit|\s*$)/i);
          if (!whereClause) return true;

          const conditions = whereClause[1];

          // Check each condition
          const paramMatches = [...conditions.matchAll(/(\w+)\s*(=|<=|>=|<|>|ilike|like)\s*\$(\d+)/gi)];
          for (const m of paramMatches) {
            const field = m[1];
            const op = m[2].toLowerCase();
            const paramIdx = parseInt(m[3]) - 1;
            const value = params[paramIdx];

            const rowVal = row[field];

            switch (op) {
              case '=':
                if (rowVal != value) match = false;
                break;
              case '<=':
                if (!(rowVal <= value)) match = false;
                break;
              case '>=':
                if (!(rowVal >= value)) match = false;
                break;
              case '<':
                if (!(rowVal < value)) match = false;
                break;
              case '>':
                if (!(rowVal > value)) match = false;
                break;
              case 'ilike':
              case 'like':
                const pattern = String(value).replace(/%/g, '.*');
                if (!new RegExp(pattern, 'i').test(rowVal || '')) match = false;
                break;
            }
          }

          // Handle literal conditions like is_active = 1 (skip 1=1 dummy conditions)
          const literalMatches = [...conditions.matchAll(/([a-z_]\w*)\s*=\s*(\d+)(?!\d*\))/gi)];
          for (const m of literalMatches) {
            const field = m[1];
            const value = parseInt(m[2]);
            if (row[field] != value) match = false;
          }

          return match;
        });
      }

      // Handle GROUP BY with COUNT
      const groupByMatch = sql.match(/group\s+by\s+(\w+)/i);
      if (groupByMatch && sqlLower.includes('count(*)')) {
        const groupField = groupByMatch[1];
        const groups = {};
        results.forEach(row => {
          const key = row[groupField] || 'null';
          if (!groups[key]) {
            groups[key] = { count: 0 };
            groups[key][groupField] = row[groupField];
          }
          groups[key].count++;
        });

        // Check for column alias like COUNT(*) as game_count
        const aliasMatch = sql.match(/count\(\*\)\s+as\s+(\w+)/i);
        const alias = aliasMatch ? aliasMatch[1] : 'count';

        results = Object.values(groups).map(g => ({
          [groupField]: g[groupField],
          [alias]: g.count
        }));
      }

      // Handle COUNT(*) without GROUP BY
      if (sqlLower.includes('count(*)') && !groupByMatch) {
        return { rows: [{ count: results.length }], rowCount: 1 };
      }

      // Handle SUM
      const sumMatch = sql.match(/sum\((\w+)\)/i);
      if (sumMatch) {
        const field = sumMatch[1];
        const total = results.reduce((acc, row) => acc + (parseFloat(row[field]) || 0), 0);
        return { rows: [{ total }], rowCount: 1 };
      }

      // Handle MAX
      const maxMatch = sql.match(/max\((\w+)\)/i);
      if (maxMatch) {
        const field = maxMatch[1];
        const values = results.map(r => r[field] || 0);
        const max = values.length > 0 ? Math.max(...values) : 0;
        return { rows: [{ max }], rowCount: 1 };
      }

      // Handle ORDER BY
      const orderMatch = sql.match(/order\s+by\s+(\w+(?:\.\w+)?)\s*(asc|desc)?/i);
      if (orderMatch) {
        const field = orderMatch[1].split('.').pop();
        const dir = (orderMatch[2] || 'asc').toLowerCase();
        results.sort((a, b) => {
          const aVal = a[field] ?? '';
          const bVal = b[field] ?? '';
          if (dir === 'desc') return bVal > aVal ? 1 : -1;
          return aVal > bVal ? 1 : -1;
        });
      }

      // Handle LIMIT and OFFSET
      const limitMatch = sql.match(/limit\s+\$(\d+)/i);
      const offsetMatch = sql.match(/offset\s+\$(\d+)/i);

      if (offsetMatch) {
        const idx = parseInt(offsetMatch[1]) - 1;
        const offset = parseInt(params[idx]) || 0;
        results = results.slice(offset);
      }

      if (limitMatch) {
        const idx = parseInt(limitMatch[1]) - 1;
        const limit = parseInt(params[idx]) || results.length;
        results = results.slice(0, limit);
      }

      return { rows: results, rowCount: results.length };
    }

    return { rows: [], rowCount: 0 };
  },

  // Get single row
  queryOne: async (sql, params = []) => {
    const result = await db.query(sql, params);
    return result.rows[0] || null;
  },

  // Get all rows
  queryAll: async (sql, params = []) => {
    const result = await db.query(sql, params);
    return result.rows;
  },

  // Initialize database (create JSON files)
  initDatabase: async () => {
    const tables = ['users', 'admins', 'games', 'transactions', 'promotions', 'checkins', 'banners'];

    for (const table of tables) {
      const filePath = getFilePath(table);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]');
        console.log(`Created ${table}.json`);
      }
    }

    // Seed default banners if empty
    const banners = readTable('banners');
    if (banners.length === 0) {
      const now = new Date().toISOString();
      const defaultBanners = [
        { id: 'banner1', name: 'Welcome Banner', image: '/New banner.png', link: '', sort_order: 1, is_active: 1, created_at: now },
        { id: 'banner2', name: 'Promo Banner', image: '/New banner 2.png', link: '', sort_order: 2, is_active: 1, created_at: now },
        { id: 'banner3', name: 'VIP Banner', image: '/New banner 3.png', link: '', sort_order: 3, is_active: 1, created_at: now }
      ];
      writeTable('banners', defaultBanners);
      console.log('Default banners created');
    }

    console.log('JSON database initialized');
  }
};

export const { query, queryOne, queryAll, initDatabase } = db;
export default db;

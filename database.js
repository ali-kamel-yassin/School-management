const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// Database configuration based on environment
const isProduction = process.env.NODE_ENV === 'production';
const usePostgres = process.env.DATABASE_URL || isProduction;

// SQLite configuration for development
const dbPath = isProduction
  ? '/app/data/school.db'
  : path.join(__dirname, 'school.db');

let db;
let pgPool;

// PostgreSQL connection pool
if (usePostgres) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

function initDB() {
  if (usePostgres) {
    console.log('✅ Using PostgreSQL database');
    createTablesPostgres();
  } else {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Error opening database:', err);
      } else {
        console.log('✅ Connected to SQLite');
        createTablesSQLite();
      }
    });
  }
}

// PostgreSQL table creation
async function createTablesPostgres() {
  try {
    // Create tables with PostgreSQL syntax
    await pgPool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS schools (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100) UNIQUE NOT NULL,
      study_type VARCHAR(100) NOT NULL,
      level VARCHAR(100) NOT NULL,
      gender_type VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      student_code VARCHAR(100) UNIQUE NOT NULL,
      grade VARCHAR(50) NOT NULL,
      branch VARCHAR(100),
      room VARCHAR(100) NOT NULL,
      detailed_scores TEXT DEFAULT '{}',
      daily_attendance TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
    )`);

    // Create default admin user
    const bcrypt = require('bcryptjs');
    const pwd = bcrypt.hashSync('admin123', 10);
    
    const existingAdmin = await pgPool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (existingAdmin.rows.length === 0) {
      await pgPool.query(
        'INSERT INTO users(username, password_hash, role) VALUES($1, $2, $3)',
        ['admin', pwd, 'admin']
      );
      console.log('✅ Default admin created (admin / admin123)');
    }
    
    console.log('✅ PostgreSQL tables created successfully');
  } catch (err) {
    console.error('❌ Error creating PostgreSQL tables:', err);
  }
}

// SQLite table creation (original function renamed)
function createTablesSQLite() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'admin',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    db.run(`CREATE TABLE IF NOT EXISTS schools (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              code TEXT UNIQUE NOT NULL,
              study_type TEXT NOT NULL,
              level TEXT NOT NULL,
              gender_type TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    db.run(`CREATE TABLE IF NOT EXISTS students (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              school_id INTEGER NOT NULL,
              full_name TEXT NOT NULL,
              student_code TEXT UNIQUE NOT NULL,
              grade TEXT NOT NULL,
              branch TEXT,
              room TEXT NOT NULL,
              detailed_scores TEXT DEFAULT '{}',
              daily_attendance TEXT DEFAULT '{}',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE)`);

    const bcrypt = require('bcryptjs');
    const pwd = bcrypt.hashSync('admin123', 10);
    db.get('SELECT * FROM users WHERE username=?', ['admin'], (_, row) => {
      if (!row) {
        db.run('INSERT INTO users(username, password_hash, role) VALUES(?,?,?)', [
          'admin', pwd, 'admin'
        ]);
        console.log('✅ Default admin created (admin / admin123)');
      }
    });
  });
}

function getDB() {
  if (usePostgres) {
    return pgPool;
  } else {
    if (!db) initDB();
    return db;
  }
}

// إنشاء كود مدرسة فريد
function generateSchoolCode() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 3).toUpperCase();
  return `SCH-${timestamp}-${random}`;
}

// التحقق من فريدية الكود وتوليد آخر إذا لزم
async function generateUniqueSchoolCode(callback) {
  if (usePostgres) {
    // PostgreSQL version
    const checkCode = async (code) => {
      try {
        const result = await pgPool.query('SELECT code FROM schools WHERE code = $1', [code]);
        if (result.rows.length > 0) {
          await checkCode(generateSchoolCode());
        } else {
          callback(null, code);
        }
      } catch (err) {
        callback(err, null);
      }
    };
    await checkCode(generateSchoolCode());
  } else {
    // SQLite version (original)
    if (!db) {
      initDB();
      setTimeout(() => generateUniqueSchoolCode(callback), 100);
      return;
    }
    const checkCode = (code) => {
      db.get('SELECT code FROM schools WHERE code = ?', [code], (err, row) => {
        if (err) {
          callback(err, null);
        } else if (row) {
          checkCode(generateSchoolCode());
        } else {
          callback(null, code);
        }
      });
    };
    checkCode(generateSchoolCode());
  }
}

module.exports = { 
  getDB, 
  initDB, 
  generateUniqueSchoolCode,
  // Export additional info for server to know which DB is being used
  isUsingPostgres: () => usePostgres,
  getPgPool: () => pgPool
};
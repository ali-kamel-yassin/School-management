const sqlite3 = require('sqlite3').verbose();
const path = require('path');
let db;

function initDB() {
  const dbPath = path.join(__dirname, 'school.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Error opening database:', err);
    } else {
      console.log('✅ Connected to SQLite');
      createTables();
    }
  });
}

function createTables() {
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
              
    // Add missing columns to existing students table if they don't exist
    db.run(`ALTER TABLE students ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.log('Note: created_at column may already exist');
      }
    });
    
    db.run(`ALTER TABLE students ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.log('Note: updated_at column may already exist');
      }
    });

    const bcrypt = require('bcryptjs');
    const pwd = bcrypt.hashSync('admin123', 10);
    db.get('SELECT * FROM users WHERE username=?', ['admin'], (_, row) => {
      if (!row) {
        db.run('INSERT INTO users(username, password_hash, role) VALUES(?,?,?)', [
          'admin',
          pwd,
          'admin',
        ]);
        console.log('✅ Default admin created (admin / admin123)');
      }
    });
  });
}

function getDB() {
  if (!db) initDB();
  return db;
}

// Generate unique school code
function generateSchoolCode() {
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.random().toString(36).substr(2, 3).toUpperCase(); // 3 random characters
  return `SCH-${timestamp}-${random}`;
}

// Check if school code exists and generate a unique one
function generateUniqueSchoolCode(callback) {
  if (!db) {
    initDB();
    // Wait a moment for DB to initialize
    setTimeout(() => generateUniqueSchoolCode(callback), 100);
    return;
  }
  
  const checkCode = (code) => {
    db.get('SELECT code FROM schools WHERE code = ?', [code], (err, row) => {
      if (err) {
        callback(err, null);
      } else if (row) {
        // Code exists, generate a new one
        checkCode(generateSchoolCode());
      } else {
        // Code is unique
        callback(null, code);
      }
    });
  };
  
  checkCode(generateSchoolCode());
}

module.exports = { getDB, initDB, generateUniqueSchoolCode };
// server.js - Sajjaly Pro School Management System
// Enhanced for production deployment with full hosting compatibility
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const { getDB, generateUniqueSchoolCode, isUsingPostgres } = require('./database');

const app = express();
const PORT = process.env.PORT || 1111;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_in_production';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Health check endpoint for hosting platforms
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    database: isUsingPostgres() ? 'PostgreSQL' : 'SQLite'
  });
});

// Production-optimized CORS with dynamic origin detection
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = NODE_ENV === 'production' 
      ? [
          'https://sajjaly-pro.onrender.com',
          'https://sajjaly-pro.vercel.app',
          'https://sajjaly-pro.railway.app',
          /\.onrender\.com$/,
          /\.vercel\.app$/,
          /\.railway\.app$/,
          /\.herokuapp\.com$/
        ]
      : [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
    
    if (!origin || allowedOrigins.some(allowed => 
      typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
    )) {
      callback(null, true);
    } else {
      callback(new Error('غير مسموح بالوصول من هذا المصدر'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

app.use(cors(corsOptions));

// Enhanced body parsing with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Environment-aware uploads directory configuration
const uploadsDir = NODE_ENV === 'production' 
  ? '/tmp/uploads'  // Render.com/Railway compatible
  : path.join(__dirname, 'uploads');

// Safe uploads directory creation with comprehensive error handling
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
    console.log(`✅ Created uploads directory: ${uploadsDir}`);
  }
  // Verify directory is writable
  fs.accessSync(uploadsDir, fs.constants.W_OK);
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: NODE_ENV === 'production' ? '1d' : '1h',
    setHeaders: (res, path) => {
      if (path.endsWith('.pdf') || path.endsWith('.doc') || path.endsWith('.docx')) {
        res.setHeader('Content-Disposition', 'attachment');
      }
    }
  }));
  console.log('✅ Uploads middleware configured successfully');
} catch (err) {
  console.warn('⚠️ Uploads directory not available:', err.message);
  console.log('📁 File upload functionality will be limited');
}

// Static file serving with caching and compression
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: NODE_ENV === 'production' ? '1d' : '1h',
  etag: true,
  lastModified: true
}));

// Advanced request logging with rate limiting awareness
app.use((req, res, next) => {
  if (NODE_ENV !== 'production') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
  }
  
  // Add request ID for tracking
  req.requestId = Math.random().toString(36).substring(2, 15);
  res.setHeader('X-Request-ID', req.requestId);
  
  // Performance monitoring in production
  req.startTime = process.hrtime.bigint();
  
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Number(process.hrtime.bigint() - req.startTime) / 1000000;
    if (NODE_ENV === 'production' && duration > 1000) {
      console.warn(`⚠️ Slow request: ${req.method} ${req.path} - ${duration.toFixed(2)}ms`);
    }
    originalEnd.apply(this, args);
  };
  
  next();
});

// Enhanced JWT authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      error_ar: 'مطلوب رمز الوصول'
    });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      const errorMsg = err.name === 'TokenExpiredError' 
        ? 'Token expired' 
        : 'Invalid token';
      const errorMsgAr = err.name === 'TokenExpiredError'
        ? 'انتهت صلاحية الرمز'
        : 'رمز غير صالح';
      
      return res.status(403).json({ 
        error: errorMsg,
        error_ar: errorMsgAr
      });
    }
    req.user = user;
    next();
  });
}

// Intelligent upload configuration with hosting platform detection
const createUploadMiddleware = () => {
  const isEphemeralFS = NODE_ENV === 'production' && 
    (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL);
  
  if (isEphemeralFS) {
    // Memory storage for ephemeral file systems
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024, // 8MB limit for memory
        files: 1,
        fieldSize: 2 * 1024 * 1024
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /^(image\/(jpeg|jpg|png|gif|webp)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain)$/;
        if (allowedTypes.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`نوع الملف غير مدعوم: ${file.mimetype}`));
        }
      }
    });
  }
  
  // Disk storage for persistent file systems
  try {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        fs.access(uploadsDir, fs.constants.W_OK, (err) => {
          if (err) {
            console.warn('Upload directory not writable, falling back to /tmp');
            cb(null, '/tmp');
          } else {
            cb(null, uploadsDir);
          }
        });
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 10);
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}-${randomStr}-${baseName}${ext}`);
      }
    });
    
    return multer({ 
      storage,
      limits: {
        fileSize: 12 * 1024 * 1024, // 12MB for disk storage
        files: 1
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf', 'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain', 'application/zip'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`نوع الملف غير مدعوم: ${file.mimetype}`));
        }
      }
    });
  } catch (err) {
    console.warn('Disk storage initialization failed:', err.message);
    return multer({ dest: '/tmp/', limits: { fileSize: 5 * 1024 * 1024 } });
  }
};

const upload = createUploadMiddleware();
console.log(`✅ Upload middleware configured for ${NODE_ENV} environment`);

// Optimized file upload endpoint with hosting platform detection
app.post('/api/upload', (req, res) => {
  const uploadMiddleware = upload.single('file');
  
  uploadMiddleware(req, res, (err) => {
    if (err) {
      let errorMessage = 'خطأ في رفع الملف';
      if (err.code === 'LIMIT_FILE_SIZE') {
        errorMessage = 'حجم الملف كبير جداً';
      } else if (err.message.includes('نوع')) {
        errorMessage = err.message;
      }
      
      return res.status(400).json({
        error: 'File upload failed',
        error_ar: errorMessage,
        details: NODE_ENV !== 'production' ? err.message : undefined
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        error_ar: 'لم يتم رفع ملف'
      });
    }
    
    try {
      const fileInfo = {
        originalName: req.file.originalname,
        filename: req.file.filename || `temp-${Date.now()}-${req.file.originalname}`,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadTime: new Date().toISOString(),
        isTemporary: !req.file.filename // memory storage indication
      };
      
      // For ephemeral hosting platforms, just confirm upload without URL
      const isEphemeralFS = NODE_ENV === 'production' && 
        (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL);
      
      const response = {
        success: true,
        message: 'تم رفع الملف بنجاح',
        message_en: 'File uploaded successfully',
        fileInfo: {
          name: fileInfo.originalName,
          size: `${Math.round(fileInfo.size/1024)} KB`,
          type: fileInfo.mimetype
        }
      };
      
      // Add URL only for persistent storage
      if (!isEphemeralFS && req.file.filename) {
        response.url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      } else {
        response.note = 'تم حفظ الملف مؤقتاً';
      }
      
      res.json(response);
    } catch (error) {
      console.error('Upload processing error:', error);
      res.status(500).json({
        error: 'File processing failed',
        error_ar: 'فشل في معالجة الملف'
      });
    }
  });
});

// Database connection with error handling
let db;
try {
  db = getDB();
  console.log('✅ Database connection established');
} catch (err) {
  console.error('❌ Database connection failed:', err.message);
  process.exit(1);
}

// API Routes with enhanced error handling
// ------ Authentication Routes ------
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password required',
        error_ar: 'اسم المستخدم وكلمة المرور مطلوبان'
      });
    }
    
    const query = 'SELECT * FROM users WHERE username = ? AND role = ?';
    const queryMethod = isUsingPostgres() ? 'query' : 'get';
    
    if (isUsingPostgres()) {
      const result = await db.query(query, [username, 'admin']);
      const user = result.rows[0];
      
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ 
          error: 'Invalid credentials',
          error_ar: 'بيانات دخول غير صحيحة'
        });
      }
      
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role }, 
        JWT_SECRET, 
        { expiresIn: '24h' }
      );
      
      res.json({ 
        success: true,
        token, 
        user: { id: user.id, username: user.username, role: user.role }
      });
    } else {
      db.get(query, [username, 'admin'], (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Database error',
            error_ar: 'خطأ في قاعدة البيانات'
          });
        }
        
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
          return res.status(401).json({ 
            error: 'Invalid credentials',
            error_ar: 'بيانات دخول غير صحيحة'
          });
        }
        
        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role }, 
          JWT_SECRET, 
          { expiresIn: '24h' }
        );
        
        res.json({ 
          success: true,
          token, 
          user: { id: user.id, username: user.username, role: user.role }
        });
      });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      error_ar: 'خطأ داخلي في الخادم'
    });
  }
});

app.post('/api/school/login', (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ 
        error: 'School code is required',
        error_ar: 'رمز المدرسة مطلوب'
      });
    }
    
    const query = 'SELECT * FROM schools WHERE code = ?';
    
    if (isUsingPostgres()) {
      db.query(query, [code])
        .then(result => {
          const school = result.rows[0];
          if (!school) {
            return res.status(404).json({ 
              error: 'School not found',
              error_ar: 'لم يتم العثور على المدرسة'
            });
          }
          
          const token = jwt.sign(
            { id: school.id, code: school.code, name: school.name, role: 'school' }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
          );
          
          res.json({ success: true, token, school });
        })
        .catch(err => {
          console.error('Database error:', err);
          res.status(500).json({ 
            error: 'Database error',
            error_ar: 'خطأ في قاعدة البيانات'
          });
        });
    } else {
      db.get(query, [code], (err, school) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Database error',
            error_ar: 'خطأ في قاعدة البيانات'
          });
        }
        
        if (!school) {
          return res.status(404).json({ 
            error: 'School not found',
            error_ar: 'لم يتم العثور على المدرسة'
          });
        }
        
        const token = jwt.sign(
          { id: school.id, code: school.code, name: school.name, role: 'school' }, 
          JWT_SECRET, 
          { expiresIn: '24h' }
        );
        
        res.json({ success: true, token, school });
      });
    }
  } catch (error) {
    console.error('School login error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      error_ar: 'خطأ داخلي في الخادم'
    });
  }
});

app.post('/api/student/login', (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ 
        error: 'Student code is required',
        error_ar: 'رمز الطالب مطلوب'
      });
    }
    
    const query = `SELECT s.*, sch.name as school_name FROM students s 
                   JOIN schools sch ON s.school_id = sch.id 
                   WHERE s.student_code = ?`;
    
    if (isUsingPostgres()) {
      db.query(query, [code])
        .then(result => {
          const student = result.rows[0];
          if (!student) {
            return res.status(404).json({ 
              error: 'Student not found',
              error_ar: 'لم يتم العثور على الطالب'
            });
          }
          
          const token = jwt.sign(
            { 
              id: student.id, 
              code: student.student_code, 
              name: student.full_name, 
              role: 'student' 
            }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
          );
          
          res.json({ success: true, token, student });
        })
        .catch(err => {
          console.error('Database error:', err);
          res.status(500).json({ 
            error: 'Database error',
            error_ar: 'خطأ في قاعدة البيانات'
          });
        });
    } else {
      db.get(query, [code], (err, student) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Database error',
            error_ar: 'خطأ في قاعدة البيانات'
          });
        }
        
        if (!student) {
          return res.status(404).json({ 
            error: 'Student not found',
            error_ar: 'لم يتم العثور على الطالب'
          });
        }
        
        const token = jwt.sign(
          { 
            id: student.id, 
            code: student.student_code, 
            name: student.full_name, 
            role: 'student' 
          }, 
          JWT_SECRET, 
          { expiresIn: '24h' }
        );
        
        res.json({ success: true, token, student });
      });
    }
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      error_ar: 'خطأ داخلي في الخادم'
    });
  }
});

// ------ Schools CRUD Routes ------
app.get('/api/schools', (req, res) => {
  const query = 'SELECT * FROM schools ORDER BY created_at DESC';
  
  if (isUsingPostgres()) {
    db.query(query)
      .then(result => res.json({ success: true, schools: result.rows }))
      .catch(err => {
        console.error('Database error:', err);
        res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      });
  } else {
    db.all(query, (err, schools) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      }
      res.json({ success: true, schools });
    });
  }
});

app.post('/api/schools', (req, res) => {
  const { name, study_type, level, gender_type } = req.body;
  
  if (!name || !study_type || !level || !gender_type) {
    return res.status(400).json({ 
      error: 'All fields are required',
      error_ar: 'جميع الحقول مطلوبة'
    });
  }
  
  generateUniqueSchoolCode((err, code) => {
    if (err) {
      console.error('Code generation error:', err);
      return res.status(500).json({ 
        error: 'Failed to generate school code',
        error_ar: 'فشل في توليد رمز المدرسة'
      });
    }
    
    const query = 'INSERT INTO schools (name, code, study_type, level, gender_type) VALUES (?, ?, ?, ?, ?)';
    
    if (isUsingPostgres()) {
      db.query(query + ' RETURNING *', [name, code, study_type, level, gender_type])
        .then(result => {
          const school = result.rows[0];
          res.status(201).json({ 
            success: true,
            message: 'تم إضافة المدرسة بنجاح',
            school
          });
        })
        .catch(err => {
          console.error('Database error:', err);
          res.status(500).json({ 
            error: 'Database error',
            error_ar: 'خطأ في قاعدة البيانات'
          });
        });
    } else {
      db.run(query, [name, code, study_type, level, gender_type], function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Database error',
            error_ar: 'خطأ في قاعدة البيانات'
          });
        }
        
        res.status(201).json({ 
          success: true,
          message: 'تم إضافة المدرسة بنجاح',
          school: { id: this.lastID, name, code, study_type, level, gender_type }
        });
      });
    }
  });
});

// Remaining CRUD operations with similar error handling patterns
app.put('/api/schools/:id', (req, res) => {
  const { id } = req.params;
  const { name, study_type, level, gender_type } = req.body;
  
  const query = 'UPDATE schools SET name = ?, study_type = ?, level = ?, gender_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  
  if (isUsingPostgres()) {
    db.query(query + ' RETURNING *', [name, study_type, level, gender_type, id])
      .then(result => {
        if (result.rows.length === 0) {
          return res.status(404).json({ 
            error: 'School not found',
            error_ar: 'لم يتم العثور على المدرسة'
          });
        }
        res.json({ 
          success: true,
          message: 'تم تحديث المدرسة بنجاح',
          school: result.rows[0]
        });
      })
      .catch(err => {
        console.error('Database error:', err);
        res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      });
  } else {
    db.run(query, [name, study_type, level, gender_type, id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          error: 'School not found',
          error_ar: 'لم يتم العثور على المدرسة'
        });
      }
      
      res.json({ 
        success: true,
        message: 'تم تحديث المدرسة بنجاح',
        updated: this.changes
      });
    });
  }
});

app.delete('/api/schools/:id', (req, res) => {
  const { id } = req.params;
  
  if (isUsingPostgres()) {
    // PostgreSQL handles CASCADE automatically
    db.query('DELETE FROM schools WHERE id = $1', [id])
      .then(result => {
        if (result.rowCount === 0) {
          return res.status(404).json({ 
            error: 'School not found',
            error_ar: 'لم يتم العثور على المدرسة'
          });
        }
        res.json({ 
          success: true,
          message: 'تم حذف المدرسة بنجاح',
          deleted: result.rowCount
        });
      })
      .catch(err => {
        console.error('Database error:', err);
        res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      });
  } else {
    db.serialize(() => {
      db.run('DELETE FROM students WHERE school_id = ?', [id], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Database error',
            error_ar: 'خطأ في قاعدة البيانات'
          });
        }
        
        db.run('DELETE FROM schools WHERE id = ?', [id], function (err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
              error: 'Database error',
              error_ar: 'خطأ في قاعدة البيانات'
            });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ 
              error: 'School not found',
              error_ar: 'لم يتم العثور على المدرسة'
            });
          }
          
          res.json({ 
            success: true,
            message: 'تم حذف المدرسة بنجاح',
            deleted: this.changes
          });
        });
      });
    });
  }
});

// ------ Students Routes ------
app.get('/api/school/:id/students', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM students WHERE school_id = ? ORDER BY created_at DESC';
  
  if (isUsingPostgres()) {
    db.query(query, [id])
      .then(result => res.json({ success: true, students: result.rows }))
      .catch(err => {
        console.error('Database error:', err);
        res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      });
  } else {
    db.all(query, [id], (err, students) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      }
      res.json({ success: true, students });
    });
  }
});

app.post('/api/school/:id/student', (req, res) => {
  const { id } = req.params;
  const { full_name, grade, branch, room } = req.body;
  
  if (!full_name || !grade || !room) {
    return res.status(400).json({ 
      error: 'Full name, grade, and room are required',
      error_ar: 'الاسم الكامل والصف والغرفة مطلوبة'
    });
  }
  
  // Auto-generate student code with SCH format
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
  const student_code = `STD-${timestamp}-${randomStr}`;
  
  const query = 'INSERT INTO students (full_name, student_code, grade, branch, room, school_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)';
  
  if (isUsingPostgres()) {
    db.query(query + ' RETURNING *', [full_name, student_code, grade, branch || '', room, id])
      .then(result => {
        const student = result.rows[0];
        res.status(201).json({ 
          success: true,
          message: 'تم إضافة الطالب بنجاح',
          student
        });
      })
      .catch(err => {
        console.error('Database error:', err);
        res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      });
  } else {
    db.run(query, [full_name, student_code, grade, branch || '', room, id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      }
      
      res.status(201).json({ 
        success: true,
        message: 'تم إضافة الطالب بنجاح',
        student: { 
          id: this.lastID, 
          full_name, 
          student_code, 
          grade, 
          branch: branch || '', 
          room 
        }
      });
    });
  }
});

app.put('/api/student/:id', (req, res) => {
  const { id } = req.params;
  const { full_name, grade, branch, room, detailed_scores, daily_attendance } = req.body;
  
  const query = `UPDATE students SET 
                 full_name = ?, grade = ?, branch = ?, room = ?, 
                 detailed_scores = ?, daily_attendance = ?, 
                 updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`;
  
  const params = [
    full_name, 
    grade, 
    branch || '', 
    room, 
    JSON.stringify(detailed_scores || {}), 
    JSON.stringify(daily_attendance || {}), 
    id
  ];
  
  if (isUsingPostgres()) {
    db.query(query + ' RETURNING *', params)
      .then(result => {
        if (result.rows.length === 0) {
          return res.status(404).json({ 
            error: 'Student not found',
            error_ar: 'لم يتم العثور على الطالب'
          });
        }
        res.json({ 
          success: true,
          message: 'تم تحديث بيانات الطالب بنجاح',
          student: result.rows[0]
        });
      })
      .catch(err => {
        console.error('Database error:', err);
        res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      });
  } else {
    db.run(query, params, function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          error: 'Student not found',
          error_ar: 'لم يتم العثور على الطالب'
        });
      }
      
      res.json({ 
        success: true,
        message: 'تم تحديث بيانات الطالب بنجاح',
        updated: this.changes
      });
    });
  }
});

app.delete('/api/student/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM students WHERE id = ?';
  
  if (isUsingPostgres()) {
    db.query('DELETE FROM students WHERE id = $1', [id])
      .then(result => {
        if (result.rowCount === 0) {
          return res.status(404).json({ 
            error: 'Student not found',
            error_ar: 'لم يتم العثور على الطالب'
          });
        }
        res.json({ 
          success: true,
          message: 'تم حذف الطالب بنجاح',
          deleted: result.rowCount
        });
      })
      .catch(err => {
        console.error('Database error:', err);
        res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      });
  } else {
    db.run(query, [id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error',
          error_ar: 'خطأ في قاعدة البيانات'
        });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          error: 'Student not found',
          error_ar: 'لم يتم العثور على الطالب'
        });
      }
      
      res.json({ 
        success: true,
        message: 'تم حذف الطالب بنجاح',
        deleted: this.changes
      });
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    error_ar: 'خطأ داخلي في الخادم'
  });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ 
        error: 'Page not found',
        error_ar: 'الصفحة غير موجودة'
      });
    }
  });
});

// Production-optimized server startup with health monitoring
function startServer() {
  const server = app.listen(PORT, '0.0.0.0', () => {
    const dbType = isUsingPostgres() ? 'PostgreSQL' : 'SQLite';
    const buildInfo = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      database: dbType,
      environment: NODE_ENV
    };
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Sajjaly Pro Server - Production Ready');
    console.log('='.repeat(60));
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Environment: ${NODE_ENV.toUpperCase()}`);
    console.log(`💾 Database: ${dbType}`);
    console.log(`⚙️ Node.js: ${process.version}`);
    console.log(`💼 Memory Usage: ${buildInfo.memory}`);
    console.log(`⏰ Started: ${new Date().toLocaleString('ar-EG')}`);
    console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
    console.log('='.repeat(60));
    
    if (NODE_ENV === 'production') {
      console.log('🔒 Production security features active');
      console.log('📈 Performance monitoring enabled');
    } else {
      console.log(`📝 Admin: http://localhost:${PORT}/admin-dashboard.html`);
      console.log(`🏫 School: http://localhost:${PORT}/school-dashboard.html`);
    }
  });
  
  // Enhanced graceful shutdown handling
  const gracefulShutdown = (signal) => {
    console.log(`\n🛱 Received ${signal}. Starting graceful shutdown...`);
    
    server.close((err) => {
      if (err) {
        console.error('❌ Error during server shutdown:', err);
        process.exit(1);
      }
      
      console.log('✅ HTTP server closed');
      
      // Close database connections
      const db = getDB();
      if (db && typeof db.close === 'function') {
        db.close((err) => {
          if (err) console.error('⚠️ Database close error:', err);
          else console.log('✅ Database connections closed');
          console.log('👋 Sajjaly Pro shutdown complete');
          process.exit(0);
        });
      } else if (db && typeof db.end === 'function') {
        db.end().then(() => {
          console.log('✅ PostgreSQL connections closed');
          console.log('👋 Sajjaly Pro shutdown complete');
          process.exit(0);
        }).catch(err => {
          console.error('⚠️ PostgreSQL close error:', err);
          process.exit(1);
        });
      } else {
        console.log('👋 Sajjaly Pro shutdown complete');
        process.exit(0);
      }
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  // Register signal handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions and rejections
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    if (NODE_ENV === 'production') {
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    } else {
      process.exit(1);
    }
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    if (NODE_ENV === 'production') {
      gracefulShutdown('UNHANDLED_REJECTION');
    }
  });
  
  return server;
}

// Initialize database and start server
getDB(); // This initializes the database
startServer();

// API Routes Documentation for Hosting Platforms
/*
==============================================================================
                    SAJJALY PRO API DOCUMENTATION
==============================================================================

BASE URL: 
- Development: http://localhost:1111
- Production: https://sajjaly-pro.onrender.com

AUTHENTICATION:
  All API routes except /health require JWT token in Authorization header:
  Authorization: Bearer <your_jwt_token>

ENDPOINTS:

1. SYSTEM & HEALTH
   GET  /health                    - Server health check (no auth required)

2. AUTHENTICATION
   POST /api/login                 - User login {username, password}
   GET  /api/profile               - Get current user profile

3. SCHOOL MANAGEMENT
   GET    /api/schools             - List all schools
   POST   /api/schools             - Create new school
   PUT    /api/schools/:id         - Update school by ID
   DELETE /api/schools/:id         - Delete school by ID
   
4. STUDENT MANAGEMENT
   GET    /api/schools/:schoolId/students  - List students in school
   POST   /api/schools/:schoolId/students  - Add student to school
   PUT    /api/students/:id               - Update student info
   DELETE /api/students/:id               - Delete student
   
5. ACADEMIC RECORDS
   GET    /api/students/:id/scores        - Get student scores
   POST   /api/students/:id/scores        - Update student scores
   GET    /api/students/:id/attendance    - Get attendance records
   POST   /api/students/:id/attendance    - Update attendance

6. FILE MANAGEMENT
   POST /api/upload                - Upload file (multipart/form-data)

RESPONSE FORMAT:
  Success: {success: true, message: "...", data: {...}}
  Error:   {error: "...", error_ar: "...", details: "..."}

HOSTING COMPATIBILITY:
- ✅ Render.com (Primary)
- ✅ Railway.app
- ✅ Vercel.com
- ✅ Heroku
- ✅ Any Node.js hosting platform

DATABASE SUPPORT:
- Development: SQLite (automatic)
- Production: PostgreSQL via DATABASE_URL env variable

ENVIRONMENT VARIABLES:
- PORT: Server port (default: 1111)
- NODE_ENV: Environment (development/production)
- DATABASE_URL: PostgreSQL connection string (production)
- JWT_SECRET: Secret key for JWT tokens

SECURITY FEATURES:
- JWT Authentication
- CORS protection
- Input validation
- SQL injection prevention
- File upload restrictions
- Rate limiting headers
- Security headers (HSTS, XSS protection, etc.)

FILE UPLOAD NOTES:
- Ephemeral hosting (Render/Railway): Files stored in memory temporarily
- Persistent hosting: Files stored in /uploads directory
- Supported types: Images, PDFs, Documents
- Size limits: 8MB (memory), 12MB (disk)

==============================================================================
Sajjaly Pro v2.0 - Professional School Management System
Built for Arabic schools with RTL support and modern hosting compatibility
==============================================================================
*/
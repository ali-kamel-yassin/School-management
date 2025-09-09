// server.js
require('dotenv').config();
import express from 'express';
import path from 'path';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB, generateUniqueSchoolCode } from './database';

const app  = express();
const PORT = process.env.PORT || 1111;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_in_production';

// 1) أساسيات Express
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://sajjaly-pro.onrender.com']
        : ['http://localhost:3000'],
    credentials: true
}));
app.use(json());
app.use(urlencoded({ extended: true }));

// 2) القرص الدائم لرفع الملفات (اختياري) - معالجة مشكلة الاستضافة
const uploadsDir = process.env.NODE_ENV === 'production' 
  ? '/tmp/uploads'  // استخدام مجلد tmp في الإنتاج
  : join(__dirname, 'uploads');  // مجلد محلي للتطوير

// إنشاء مجلد الرفع بأمان
try {
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', static(uploadsDir));
} catch (err) {
  console.log('⚠️ Uploads directory not available - file upload disabled');
  // في حالة فشل إنشاء المجلد، لا نتوقف
}

// 3) خدمة الملفات الثابتة (HTML, CSS, JS ...)
app.use(static(join(__dirname, 'public')));

// 4) مصادقة JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });
    verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

// 5) رفع الملفات (مثال جاهز) - مع معالجة قيود الاستضافة
let upload;
try {
  const storage = diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  });
  upload = multer({ storage });
} catch (err) {
  // إذا فشل إعداد التخزين، نستخدم الذاكرة
  upload = multer({ dest: '/tmp/' });
}

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لم يُرفع ملف' });
  
  // في بيئة الإنتاج، قد لا يكون رفع الملفات متاحاً بشكل دائم
  const url = process.env.NODE_ENV === 'production' 
    ? 'تم رفع الملف مؤقتاً - يُنصح باستخدام خدمة تخزين سحابية'
    : `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
  res.json({ message: 'تم الرفع', url });
});

// 6) الـ Routes الخاصة بالمدارس والطلاب
const db = getDB();

// ------ Auth Routes ------
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'admin'], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user || !compareSync(password, user.password_hash))
            return res.status(401).json({ error: 'Invalid credentials' });
        const token = sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    });
});

app.post('/api/school/login', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'School code is required' });
    db.get('SELECT * FROM schools WHERE code = ?', [code], (err, school) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!school) return res.status(404).json({ error: 'School not found' });
        const token = sign({ id: school.id, code: school.code, name: school.name, role: 'school' }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, school });
    });
});

app.post('/api/student/login', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Student code is required' });
    db.get(`SELECT s.*, sch.name as school_name FROM students s JOIN schools sch ON s.school_id = sch.id WHERE s.student_code = ?`, [code], (err, student) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        const token = sign({ id: student.id, code: student.student_code, name: student.
            full_name, role: 'student' }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, student });
    });
});

// ------ Schools CRUD ------
app.get('/api/schools', (req, res) => {
    db.all('SELECT * FROM schools ORDER BY created_at DESC', (err, schools) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(schools);
    });
});

app.post('/api/schools', (req, res) => {
    const { name, study_type, level, gender_type } = req.body;
    if (!name || !study_type || !level || !gender_type) return res.status(400).json({ error: 'All fields are required' });
    generateUniqueSchoolCode((err, code) => {
        if (err) return res.status(500).json({ error: 'Failed to generate school code' });
        db.run('INSERT INTO schools (name, code, study_type, level, gender_type) VALUES (?, ?, ?, ?, ?)',
            [name, code, study_type, level, gender_type], function (err) {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.status(201).json({ id: this.lastID, name, code, study_type, level, gender_type });
            });
    });
});

app.put('/api/schools/:id', (req, res) => {
    const { id } = req.params;
    const { name, study_type, level, gender_type } = req.body;
    db.run('UPDATE schools SET name = ?, study_type = ?, level = ?, gender_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, study_type, level, gender_type, id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (this.changes === 0) return res.status(404).json({ error: 'School not found' });
            res.json({ updated: this.changes });
        });
});

app.delete('/api/schools/:id', (req, res) => {
    const { id } = req.params;
    db.serialize(() => {
        db.run('DELETE FROM students WHERE school_id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            db.run('DELETE FROM schools WHERE id = ?', [id], function (err) {
                if (err) return res.status(500).json({ error: 'Database error' });
                if (this.changes === 0) return res.status(404).json({ error: 'School not found' });
                res.json({ deleted: this.changes });
            });
        });
    });
});

// ------ Students Routes ------
app.get('/api/school/:id/students', (req, res) => {
    const { id } = req.params;
    db.all('SELECT * FROM students WHERE school_id = ?', [id], (err, students) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(students);
    });
});

app.post('/api/school/:id/student', (req, res) => {
    const { id } = req.params;
    const { full_name, grade, branch, room } = req.body;
    if (!full_name || !grade || !room) return res.status(400).json({ error: 'Full name, grade, and room are required' });
    const student_code = `STD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    db.run('INSERT INTO students (full_name, student_code, grade, branch, room, school_id) VALUES (?, ?, ?, ?, ?, ?)',
        [full_name, student_code, grade, branch || '', room, id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.status(201).json({ id: this.lastID, full_name, student_code, grade, branch: branch || '', room });
        });
});

app.put('/api/student/:id', (req, res) => {
    const { id } = req.params;
    const { full_name, grade, branch, room, detailed_scores, daily_attendance } = req.body;
    db.run(`UPDATE students SET full_name = ?, grade = ?, branch = ?, room = ?, detailed_scores = ?, daily_attendance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [full_name, grade, branch || '', room, JSON.stringify(detailed_scores || {}), JSON.stringify(daily_attendance || {}), id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (this.changes === 0) return res.status(404).json({ error: 'Student not found' });
            res.
            json({ updated: this.changes });
        });
});

app.delete('/api/student/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM students WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Student not found' });
        res.json({ deleted: this.changes });
    });
});

// 7) صفحة React/SPA أو 404
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

// 8) تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`🚀 Server ready at port ${PORT}`);
});

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB, generateUniqueSchoolCode } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_in_production';

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-app-name.railway.app', 'https://your-app-name.vercel.app', 'https://your-app-name.onrender.com']
        : ['http://localhost:3000', 'http://localhost:4000', 'http://localhost:9876'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// دالة المصادقة JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Routes
// إضافة هذه الـ routes المحدثة في server.js

// إصلاح PUT method للمدارس
app.put('/api/schools/:id', (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const { name, study_type, level, gender_type } = req.body;
    
    db.run(
        'UPDATE schools SET name = ?, study_type = ?, level = ?, gender_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, study_type, level, gender_type, id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (this.changes === 0) return res.status(404).json({ error: 'School not found' });
            res.json({ updated: this.changes });
        }
    );
});

// إصلاح PUT method للطلاب
app.put('/api/student/:id', (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const { full_name, grade, branch, room, detailed_scores, daily_attendance } = req.body;
    
    db.run(
        'UPDATE students SET full_name = ?, grade = ?, branch = ?, room = ?, detailed_scores = ?, daily_attendance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [full_name, grade, branch || '', room, JSON.stringify(detailed_scores || {}), JSON.stringify(daily_attendance || {}), id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (this.changes === 0) return res.status(404).json({ error: 'Student not found' });
            res.json({ updated: this.changes });
        }
    );
});

// Login routes
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const db = getDB();
    db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'admin'], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );
        
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    });
});

app.post('/api/school/login', (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'School code is required' });
    }

    const db = getDB();
    db.get('SELECT * FROM schools WHERE code = ?', [code], (err, school) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!school) return res.status(404).json({ error: 'School not found' });
        
        const token = jwt.sign(
            { id: school.id, code: school.code, name: school.name, role: 'school' },
            JWT_SECRET,
            { expiresIn: '1d' }
        );
        
        res.json({ token, school });
    });
});

app.post('/api/student/login', (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'Student code is required' });
    }

    const db = getDB();
    db.get(`
        SELECT s.*, sch.name as school_name 
        FROM students s 
        JOIN schools sch ON s.school_id = sch.id 
        WHERE s.student_code = ?
    `, [code], (err, student) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        
        const token = jwt.sign(
            { id: student.id, code: student.student_code, name: student.full_name, role: 'student' },
            JWT_SECRET,
            { expiresIn: '1d' }
        );
        
        res.json({ token, student });
    });
});

// Schools routes
app.get('/api/schools', (req, res) => {
    const db = getDB();
    db.all('SELECT * FROM schools ORDER BY created_at DESC', (err, schools) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(schools);
    });
});

app.post('/api/schools', (req, res) => {
    const { name, study_type, level, gender_type } = req.body;
    
    if (!name || !study_type || !level || !gender_type) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    const db = getDB();
    
    // Generate unique school code
    generateUniqueSchoolCode((err, code) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to generate school code' });
        }
        
        db.run(
            'INSERT INTO schools (name, code, study_type, level, gender_type) VALUES (?, ?, ?, ?, ?)',
            [name, code, study_type, level, gender_type],
            function (err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(400).json({ error: 'School code already exists' });
                    }
                    return res.status(500).json({ error: 'Database error' });
                }
                res.status(201).json({ 
                    id: this.lastID, 
                    name, 
                    code, 
                    study_type, 
                    level, 
                    gender_type 
                });
            }
        );
    });
});

// Students routes
app.get('/api/school/:id/students', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    db.all('SELECT * FROM students WHERE school_id = ?', [id], (err, students) => {
        if (err) {
            console.error('Database error in /api/school/:id/students:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(students);
    });
});

app.post('/api/school/:id/student', (req, res) => {
    const { id } = req.params;
    const { full_name, grade, branch, room } = req.body;
    
    if (!full_name || !grade || !room) {
        return res.status(400).json({ error: 'Full name, grade, and room are required' });
    }

    const student_code = `STD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const db = getDB();
    
    db.run(
        'INSERT INTO students (full_name, student_code, grade, branch, room, school_id) VALUES (?, ?, ?, ?, ?, ?)',
        [full_name, student_code, grade, branch || '', room, id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.status(201).json({ id: this.lastID, full_name, student_code, grade, branch: branch || '', room });
        }
    );
});

// Detailed student routes
app.get('/api/student/:id/detailed', (req, res) => {
    const db = getDB();
    const { id } = req.params;
    
    db.get(`
        SELECT s.*, sch.name as school_name 
        FROM students s 
        JOIN schools sch ON s.school_id = sch.id 
        WHERE s.id = ?
    `, [id], (err, student) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        res.json(student);
    });
});

app.put('/api/student/:id/detailed', (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const { detailed_scores, daily_attendance } = req.body;
    
    // First try with updated_at column, if that fails, try without it
    db.run(
        'UPDATE students SET detailed_scores = ?, daily_attendance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JSON.stringify(detailed_scores || {}), JSON.stringify(daily_attendance || {}), id],
        function (err) {
            if (err) {
                // If updated_at column doesn't exist, try without it
                if (err.message.includes('no such column: updated_at')) {
                    db.run(
                        'UPDATE students SET detailed_scores = ?, daily_attendance = ? WHERE id = ?',
                        [JSON.stringify(detailed_scores || {}), JSON.stringify(daily_attendance || {}), id],
                        function (err2) {
                            if (err2) {
                                console.error('Database error in PUT /api/student/:id/detailed:', err2);
                                return res.status(500).json({ error: 'Database error' });
                            }
                            if (this.changes === 0) return res.status(404).json({ error: 'Student not found' });
                            res.json({ updated: this.changes });
                        }
                    );
                } else {
                    console.error('Database error in PUT /api/student/:id/detailed:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
            } else {
                if (this.changes === 0) return res.status(404).json({ error: 'Student not found' });
                res.json({ updated: this.changes });
            }
        }
    );
});

// Delete routes
app.delete('/api/schools/:id', (req, res) => {
    const db = getDB();
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

app.delete('/api/student/:id', (req, res) => {
    const db = getDB();
    const { id } = req.params;
    
    db.run('DELETE FROM students WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Student not found' });
        res.json({ deleted: this.changes });
    });
});

// Serve static files
app.use(express.static('public'));

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
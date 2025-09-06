# 🎓 Sajjaly Pro - Professional School Management System

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-16+-green)
![Express](https://img.shields.io/badge/Express-4.19-blue)
![SQLite](https://img.shields.io/badge/SQLite-5.1-orange)
![Arabic](https://img.shields.io/badge/Language-Arabic-red)

**نظام إدارة المدارس المتكامل**

[🚀 Deploy Now](#-deployment) • [📋 Features](#-features) • [🔧 Setup](#-local-setup) • [📖 Documentation](#-documentation)

</div>

## 📋 Features

### 👨‍💼 Admin Dashboard
- ✅ School registration and management
- ✅ School codes auto-generation
- ✅ System overview and statistics

### 🏫 School Management  
- ✅ Student registration with auto-generated codes
- ✅ Subject management (Add/Edit/Delete)
- ✅ Grade management (6 periods: Month 1-4, Midterm, Final)
- ✅ Daily attendance tracking
- ✅ Pass/Fail calculation (50% threshold)

### 👨‍🎓 Student Portal
- ✅ Grade viewing (without totals - shows pass/fail status)
- ✅ Daily attendance records
- ✅ Personal information display
- ✅ RTL Arabic interface

## 🛠 Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite3
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Authentication**: JWT + bcrypt
- **Languages**: Arabic (RTL) + English

## 🚀 Deployment

> **Note**: This is a full-stack application that requires a Node.js server. GitHub Pages won't work.

### Recommended Platforms:

#### 1. 🚂 Railway (Easiest)
1. Push to GitHub
2. Go to [Railway.app](https://railway.app) 
3. Deploy from GitHub repo
4. Done! ✨

#### 2. 🎨 Render
1. Push to GitHub  
2. Go to [Render.com](https://render.com)
3. New Web Service from GitHub
4. Build: `npm install`, Start: `npm start`

#### 3. ▲ Vercel  
1. `npm i -g vercel`
2. `vercel --prod`

📖 **[Complete Deployment Guide](DEPLOYMENT.md)**

## 🔧 Local Setup

```bash
# Clone repository
git clone <your-repo-url>
cd sajjaly-pro

# Install dependencies
npm install

# Initialize database
npm run init-db

# Start development server
npm run dev

# OR start production server
npm start
```

Open: http://localhost:9876

## 🔑 Default Credentials

- **Admin Login**: `admin` / `admin123`
- **School**: Create via admin dashboard
- **Students**: Auto-generated codes

## 📁 Project Structure

```
sajjaly-pro/
├── server.js           # Express server & API routes
├── database.js         # SQLite database setup
├── public/            
│   ├── index.html      # Landing page
│   ├── admin-dashboard.html
│   ├── school-dashboard.html  
│   ├── student-portal.html
│   └── assets/
│       ├── css/        # Stylesheets
│       └── js/         # Client-side JavaScript
├── package.json
├── railway.json        # Railway deployment config
├── render.yaml         # Render deployment config
├── vercel.json         # Vercel deployment config
└── DEPLOYMENT.md       # Detailed deployment guide
```

## 🔒 Security Features

- JWT authentication
- Password hashing (bcrypt)
- CORS protection
- Input validation
- SQL injection prevention

## 🌐 API Endpoints

### Authentication
- `POST /api/admin/login` - Admin login
- `POST /api/school/login` - School login  
- `POST /api/student/login` - Student login

### Schools
- `GET /api/schools` - List all schools
- `POST /api/schools` - Create school
- `PUT /api/schools/:id` - Update school
- `DELETE /api/schools/:id` - Delete school

### Students  
- `GET /api/school/:id/students` - School students
- `POST /api/school/:id/student` - Add student
- `PUT /api/student/:id` - Update student
- `PUT /api/student/:id/detailed` - Update grades/attendance
- `DELETE /api/student/:id` - Delete student

## 🎯 Usage Flow

1. **Admin** creates schools and manages system
2. **Schools** register students and manage grades/attendance  
3. **Students** view their grades and attendance records

## 📱 Responsive Design

- ✅ Mobile-friendly interface
- ✅ RTL Arabic layout
- ✅ Modern UI/UX
- ✅ Accessible design

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`  
5. Submit pull request

## 📄 License

MIT License - feel free to use for educational purposes

## 📞 Support

For deployment issues, check [DEPLOYMENT.md](DEPLOYMENT.md) or create an issue.

---

<div align="center">

**Built with ❤️ for the Arabic education community**

[⭐ Star this repo](../../stargazers) • [🐛 Report bug](../../issues) • [💡 Request feature](../../issues)

</div>
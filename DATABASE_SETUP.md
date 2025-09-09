# Database Setup Guide

## 🚀 Quick Setup with Supabase (Recommended)

### Step 1: Create Supabase Account
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. Create New Project:
   - **Project Name:** `sajjaly-pro-db`
   - **Database Password:** Choose a strong password and SAVE IT!
   - **Region:** Choose closest to your location
   - Wait for project to be ready (2-3 minutes)

### Step 2: Get Database Connection String
1. In your Supabase dashboard, go to **Settings** → **Database**
2. Find **Connection string** section
3. Select **URI** tab
4. Copy the connection string (looks like): 
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the password you created

### Step 3: Configure Environment Variables

#### For Local Development:
1. Create `.env` file in your project root
2. Add:
   ```bash
   DATABASE_URL=your_supabase_connection_string_here
   JWT_SECRET=your_strong_secret_key_here
   NODE_ENV=development
   ```

#### For Render.com Production:
1. Go to your Render.com service dashboard
2. Go to **Environment** tab
3. Add these variables:
   - `DATABASE_URL` = Your Supabase connection string
   - `JWT_SECRET` = A strong secret key (generate one!)
   - `NODE_ENV` = `production`

### Step 4: Test Locally
```bash
npm install
npm start
```

The app will:
- ✅ Connect to PostgreSQL if `DATABASE_URL` is set
- ✅ Fall back to SQLite for local development if not set
- ✅ Automatically create tables and default admin user

### Step 5: Deploy to Render
1. Push your code to GitHub
2. Deploy on Render.com
3. Set environment variables in Render dashboard
4. ✅ Your data will now persist permanently!

## 🔒 Security Notes

### Generate Strong JWT Secret
Use a strong random string for `JWT_SECRET`. You can generate one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database Security
- ✅ Supabase uses SSL by default
- ✅ Connection strings include authentication
- ✅ Your database is isolated and secure

## 🔄 Migration from SQLite

If you have existing SQLite data you want to migrate:
1. Export data from SQLite
2. Import into your new PostgreSQL database
3. The app will work with both during transition

## 🆘 Troubleshooting

### Connection Issues
- Check that `DATABASE_URL` is correctly formatted
- Ensure your Supabase project is running
- Verify password is correct in connection string

### Local vs Production
- **Local:** Uses SQLite if `DATABASE_URL` not set
- **Production:** Uses PostgreSQL with `DATABASE_URL`
- Both work with the same code automatically!

## 🎉 Benefits of This Setup

✅ **Permanent Data Storage** - No more data loss on restarts  
✅ **Automatic Backups** - Supabase handles this  
✅ **Scalable** - Can handle thousands of students  
✅ **Free Tier** - 500MB should be plenty for school data  
✅ **Real-time Features** - Can add real-time updates later  
✅ **SQL Access** - Direct database access through Supabase dashboard  

Your school management system is now production-ready! 🎓
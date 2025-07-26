# 🚂 Railway Deployment Guide for Eventloo

## 📋 **Overview**
This guide will help you deploy your Eventloo application (Django backend + React frontend) on Railway.com.

## 🎯 **What We'll Deploy**
- **Backend**: Django API with PostgreSQL database
- **Frontend**: React static site
- **Database**: PostgreSQL (provided by Railway)

---

## 🚀 **Step 1: Prepare Your Repository**

### **1.1 Push Latest Changes**
```bash
git add .
git commit -m "Configure for Railway deployment"
git push origin main
```

### **1.2 Verify Files**
Make sure these files are in your repository:
- ✅ `railway.json` (Railway configuration)
- ✅ `railway.toml` (Railway TOML config)
- ✅ `nixpacks.toml` (Build configuration)
- ✅ `backend/requirements.txt` (Python dependencies)
- ✅ `backend/runtime.txt` (Python version)
- ✅ `frontend/package.json` (Node.js dependencies)

---

## 🚀 **Step 2: Deploy Backend on Railway**

### **2.1 Create Railway Account**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create a new project

### **2.2 Deploy Backend Service**
1. **Click "Deploy from GitHub repo"**
2. **Select your repository**: `midlajmidu/eventloo`
3. **Set Root Directory**: `backend` (Railway will auto-detect this from `backend/railway.json`)
4. **Click "Deploy"**

### **2.3 Configure Environment Variables**
In your Railway backend service, add these environment variables:

```env
# Django Settings
SECRET_KEY=your-super-secret-key-here
DEBUG=False
DJANGO_SETTINGS_MODULE=event_management.settings

# Database (Railway will auto-set DATABASE_URL)
DATABASE_URL=postgresql://...

# CORS Settings
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001
RAILWAY_FRONTEND_URL=https://your-frontend-service.railway.app

# Static Files
STATIC_URL=/static/
STATIC_ROOT=/opt/render/project/src/staticfiles
MEDIA_URL=/media/
MEDIA_ROOT=/opt/render/project/src/media

# Python Version
PYTHON_VERSION=3.11.9
```

### **2.4 Add PostgreSQL Database**
1. **Click "New" → "Database" → "PostgreSQL"**
2. **Name it**: `eventloo-db`
3. **Railway will auto-connect it to your backend**

### **2.5 Get Your Backend URL**
After deployment, Railway will give you a URL like:
```
https://eventloo-backend-production-xxxx.up.railway.app
```

**Save this URL!** You'll need it for the frontend.

---

## 🚀 **Step 3: Deploy Frontend on Railway**

### **3.1 Create Frontend Service**
1. **In the same Railway project, click "New" → "Service"**
2. **Select "Deploy from GitHub repo"**
3. **Select your repository again**: `midlajmidu/eventloo`
4. **Set Root Directory**: `frontend` (Railway will auto-detect this from `frontend/railway.json`)
5. **Click "Deploy"**

### **3.2 Configure Frontend Environment**
Add this environment variable to your frontend service:

```env
REACT_APP_API_URL=https://your-backend-url.railway.app/api
```

**Replace `your-backend-url` with your actual backend URL from Step 2.5**

### **3.3 Configure Build Settings**
In your frontend service settings:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npx serve -s build -l $PORT`

---

## 🚀 **Step 4: Update CORS Settings**

### **4.1 Get Frontend URL**
After frontend deployment, get your frontend URL:
```
https://eventloo-frontend-production-xxxx.up.railway.app
```

### **4.2 Update Backend CORS**
Go back to your backend service and update the environment variable:

```env
RAILWAY_FRONTEND_URL=https://your-frontend-url.railway.app
```

### **4.3 Redeploy Backend**
Click "Deploy" on your backend service to apply the CORS changes.

---

## 🚀 **Step 5: Test Your Deployment**

### **5.1 Test Backend**
Open your backend URL + `/api/admin/dashboard/summary/`:
```
https://your-backend-url.railway.app/api/admin/dashboard/summary/
```

You should see either:
- ✅ JSON response (if you have data)
- ✅ Authentication error (normal - means backend is working)

### **5.2 Test Frontend**
Open your frontend URL:
```
https://your-frontend-url.railway.app
```

You should see:
- ✅ Your React app loading
- ✅ Backend connection working
- ✅ No "Failed to fetch" errors

---

## 🔧 **Troubleshooting**

### **Backend Issues**
1. **Check Railway logs** for build errors
2. **Verify environment variables** are set correctly
3. **Check database connection** in logs
4. **Ensure Python version** is 3.11.9

### **Frontend Issues**
1. **Verify REACT_APP_API_URL** is correct
2. **Check build logs** for npm errors
3. **Ensure backend URL** is accessible

### **CORS Issues**
1. **Update RAILWAY_FRONTEND_URL** in backend
2. **Redeploy backend** after CORS changes
3. **Check browser console** for CORS errors

---

## 📱 **Final URLs**

After successful deployment, you'll have:

- **Backend API**: `https://eventloo-backend-production-xxxx.up.railway.app/api`
- **Frontend App**: `https://eventloo-frontend-production-xxxx.up.railway.app`
- **Database**: Automatically managed by Railway

---

## 🎉 **Success!**

Your Eventloo application is now deployed on Railway and accessible to everyone!

**Share your frontend URL with others** - they'll be able to access your app from anywhere in the world.

---

## 🔄 **Local Development**

For local development, keep using:
- **Backend**: `http://localhost:8000`
- **Frontend**: `http://localhost:3000`
- **Database**: SQLite (local)

Your local environment will continue to work as before. 
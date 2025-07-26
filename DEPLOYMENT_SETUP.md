# 🚀 Eventloo Deployment Setup Guide

## 📋 **Current Issue**
- Frontend works locally on your laptop ✅
- Others can't access it because it tries to connect to `localhost:8000` ❌

## 🔧 **Solution: Deploy to Render**

### **Step 1: Deploy Backend to Render**

1. **Go to [Render Dashboard](https://dashboard.render.com/)**
2. **Create New Web Service**
3. **Configure:**
   - **Name:** `eventloo-backend`
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements-production.txt`
   - **Start Command:** `gunicorn event_management.wsgi:application`
   - **Environment:** Python 3.11

4. **Add Environment Variables:**
   ```
   SECRET_KEY=your-secret-key-here
   DEBUG=False
   ALLOWED_HOSTS=eventloo-backend.onrender.com
   DATABASE_URL=your-postgresql-url
   CORS_ALLOWED_ORIGINS=https://eventloo-frontend.onrender.com
   ```

### **Step 2: Deploy Frontend to Render**

1. **Create New Static Site**
2. **Configure:**
   - **Name:** `eventloo-frontend`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `build`

3. **Add Environment Variable:**
   ```
   REACT_APP_API_URL=https://eventloo-backend.onrender.com/api
   ```

### **Step 3: Local Development Setup**

For local development, create `frontend/.env`:
```
REACT_APP_API_URL=http://localhost:8000/api
```

### **Step 4: Production URLs**

After deployment, you'll have:
- **Backend API:** `https://eventloo-backend.onrender.com/api`
- **Frontend App:** `https://eventloo-frontend.onrender.com`

## 🔍 **How to Check Backend Connection**

### **Method 1: Debug Component**
- Run frontend locally: `npm start`
- Look for green debug box in top-right corner
- Shows current backend URL

### **Method 2: Browser Console**
- Press F12 → Console tab
- Look for: `🔧 API Configuration Debug:`

### **Method 3: Network Tab**
- F12 → Network tab
- Check request URLs

## 📱 **Sharing Your App**

Once deployed on Render:
1. **Share frontend URL:** `https://eventloo-frontend.onrender.com`
2. **Everyone can access it** (no localhost issues)
3. **Backend automatically handles requests**

## ⚡ **Quick Test**

1. **Deploy backend first**
2. **Deploy frontend with correct environment variable**
3. **Test the frontend URL**
4. **Share with others!**

## 🎯 **Environment Variables Summary**

| Environment | REACT_APP_API_URL |
|-------------|-------------------|
| **Local** | `http://localhost:8000/api` |
| **Production** | `https://eventloo-backend.onrender.com/api` |

---

**Status:** ✅ Ready for deployment
**Next Step:** Deploy to Render following the steps above 
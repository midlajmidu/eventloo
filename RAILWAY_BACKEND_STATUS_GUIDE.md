# 🚂 Railway Backend Status & Monitoring Guide

## 📍 How to Access Railway Dashboard

### **Step 1: Go to Railway Dashboard**
1. Visit [https://railway.app/dashboard](https://railway.app/dashboard)
2. Sign in with your GitHub account
3. You'll see your projects list

### **Step 2: Find Your Project**
- Look for your project (likely named something like "eventloo-backend")
- Click on the project to open it

## 🔍 Checking Backend Status

### **Project Overview Page**
Once you click on your project, you'll see:

#### **1. Service Status**
- **Green dot** = Running ✅
- **Red dot** = Stopped ❌
- **Yellow dot** = Building/Starting 🔄

#### **2. Service Information**
- **Service Name:** eventloo-backend (or similar)
- **Status:** Running/Stopped/Deploying
- **Last Deployed:** Date and time
- **Domain:** Your Railway URL

#### **3. Resource Usage**
- **CPU Usage:** Current CPU consumption
- **Memory Usage:** RAM usage
- **Network:** Data transfer

## 🌐 Getting Your Backend URL

### **Method 1: From Dashboard**
1. In your project dashboard
2. Look for **"Domains"** section
3. You'll see: `https://eventloo-backend.railway.app`
4. Click to copy the URL

### **Method 2: From Service Settings**
1. Click on your service
2. Go to **"Settings"** tab
3. Scroll to **"Domains"** section
4. Copy the generated URL

### **Method 3: Custom Domain (Optional)**
1. In **"Settings"** → **"Domains"**
2. Click **"Add Domain"**
3. Enter your custom domain
4. Configure DNS settings

## 📊 Monitoring Your Backend

### **1. Logs**
- **Real-time logs:** Click "Logs" tab
- **View deployment logs:** See build process
- **Application logs:** Django server logs
- **Error logs:** Any issues or crashes

### **2. Metrics**
- **CPU Usage:** Monitor performance
- **Memory Usage:** Check resource consumption
- **Network:** Data transfer stats
- **Response Time:** API performance

### **3. Environment Variables**
- Go to **"Variables"** tab
- Check all environment variables are set:
  ```
  DATABASE_URL=postgresql://...
  SECRET_KEY=your-secret-key
  DEBUG=False
  ALLOWED_HOSTS=eventloo-backend.railway.app
  CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
  ```

## 🧪 Testing Your Backend

### **1. Health Check**
Visit: `https://eventloo-backend.railway.app/`
- Should show Django welcome page or API response

### **2. API Test**
Visit: `https://eventloo-backend.railway.app/api/`
- Should show API endpoints

### **3. Admin Panel**
Visit: `https://eventloo-backend.railway.app/admin/`
- Should show Django admin login

### **4. Database Connection**
- Check logs for database connection errors
- Verify DATABASE_URL is correct

## 🔧 Common Issues & Solutions

### **Issue: Service Not Starting**
**Check:**
1. **Logs** for error messages
2. **Environment variables** are set correctly
3. **Requirements.txt** is valid
4. **Port configuration** (Railway sets PORT env var)

### **Issue: Database Connection Failed**
**Check:**
1. **DATABASE_URL** format is correct
2. **Database service** is running
3. **Migrations** have been applied

### **Issue: API Not Responding**
**Check:**
1. **Service is running** (green status)
2. **Logs** for Django errors
3. **CORS settings** for frontend access
4. **ALLOWED_HOSTS** includes your domain

## 📱 Railway CLI (Optional)

### **Install Railway CLI**
```bash
npm install -g @railway/cli
```

### **Login to Railway**
```bash
railway login
```

### **Check Status**
```bash
railway status
```

### **View Logs**
```bash
railway logs
```

### **Deploy Manually**
```bash
railway up
```

## 🎯 Success Indicators

✅ **Service Status:** Green (Running)
✅ **Domain:** `https://eventloo-backend.railway.app`
✅ **Health Check:** Returns 200 OK
✅ **API Endpoints:** Accessible
✅ **Database:** Connected and migrated
✅ **Logs:** No errors
✅ **Environment Variables:** All set correctly

## 🔗 Quick Links

- **Railway Dashboard:** https://railway.app/dashboard
- **Your Backend URL:** `https://eventloo-backend.railway.app`
- **API Endpoints:** `https://eventloo-backend.railway.app/api/`
- **Admin Panel:** `https://eventloo-backend.railway.app/admin/`

## 📞 Support

If you encounter issues:
1. **Check Railway logs** first
2. **Verify environment variables**
3. **Test endpoints** manually
4. **Contact Railway support** if needed

---

**🎉 Your Railway backend should be running smoothly!** 
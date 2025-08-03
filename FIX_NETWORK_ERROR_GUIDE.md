# 🔧 Fix Network Error Between Frontend and Backend

## 🚨 Current Issue
**Error:** "Network error. Please check your internet connection and try again."

## 🔍 Step-by-Step Diagnosis

### **Step 1: Check Your URLs**
First, get your actual URLs:

**Railway Backend URL:**
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click on your backend project
3. Copy the Domain URL (e.g., `https://eventloo-backend.railway.app`)

**Vercel Frontend URL:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your frontend project
3. Copy the Domain URL (e.g., `https://eventloo-frontend.vercel.app`)

### **Step 2: Update Environment Variables**

#### **In Vercel (Frontend):**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your frontend project
3. Go to **"Settings"** → **"Environment Variables"**
4. Add/Update:
```
REACT_APP_API_URL=https://your-railway-backend-url.railway.app
```

#### **In Railway (Backend):**
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click on your backend project
3. Go to **"Variables"** tab
4. Add/Update:
```
CORS_ALLOWED_ORIGINS=https://your-vercel-frontend-url.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-vercel-frontend-url.vercel.app
```

### **Step 3: Test Backend Directly**

#### **Test Backend Health:**
```bash
curl https://your-railway-backend-url.railway.app/
```

#### **Test API Endpoints:**
```bash
curl https://your-railway-backend-url.railway.app/api/
```

#### **Test Token Endpoint:**
```bash
curl -X POST https://your-railway-backend-url.railway.app/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

### **Step 4: Check Railway Logs**

1. Go to Railway Dashboard
2. Click on your backend project
3. Go to **"Logs"** tab
4. Look for any errors or issues

### **Step 5: Check Vercel Environment Variables**

1. Go to Vercel Dashboard
2. Click on your frontend project
3. Go to **"Settings"** → **"Environment Variables"**
4. Verify `REACT_APP_API_URL` is set correctly

### **Step 6: Redeploy Both Services**

#### **Redeploy Frontend:**
1. Go to Vercel Dashboard
2. Click on your frontend project
3. Go to **"Deployments"** tab
4. Click **"Redeploy"** on latest deployment

#### **Redeploy Backend:**
1. Go to Railway Dashboard
2. Click on your backend project
3. Railway should auto-redeploy when you update variables

### **Step 7: Test in Browser**

1. Open your Vercel frontend URL
2. Open browser developer tools (F12)
3. Go to **"Console"** tab
4. Try to login
5. Check for any error messages

## 🔧 Common Issues & Solutions

### **Issue 1: Backend Not Responding**
**Symptoms:** Backend URL returns 404 or timeout
**Solutions:**
1. Check Railway service status (should be green)
2. Check Railway logs for errors
3. Verify DATABASE_URL is correct
4. Check if migrations are applied

### **Issue 2: CORS Errors**
**Symptoms:** Browser console shows CORS errors
**Solutions:**
1. Update `CORS_ALLOWED_ORIGINS` in Railway
2. Include exact Vercel frontend URL
3. Redeploy backend after updating variables

### **Issue 3: Wrong API URL**
**Symptoms:** API calls go to wrong URL
**Solutions:**
1. Check `REACT_APP_API_URL` in Vercel
2. Verify Railway backend URL is correct
3. Redeploy frontend after updating variables

### **Issue 4: Database Connection Issues**
**Symptoms:** Backend responds but login fails
**Solutions:**
1. Check Railway logs for database errors
2. Verify DATABASE_URL format
3. Check if admin user exists

## 🧪 Debug Script

Run this script to test the connection:

```bash
./debug-network-error.sh
```

**Update the URLs in the script first with your actual URLs.**

## 🎯 Success Indicators

✅ **Backend responds** to direct curl requests
✅ **Frontend loads** without console errors
✅ **API calls** go to correct Railway URL
✅ **No CORS errors** in browser console
✅ **Login works** with admin credentials

## 📱 Quick Commands

### **Test Backend:**
```bash
curl https://your-railway-backend-url.railway.app/api/
```

### **Test Frontend:**
```bash
curl https://your-vercel-frontend-url.vercel.app
```

### **Check Environment Variables:**
- **Vercel:** Dashboard → Settings → Environment Variables
- **Railway:** Dashboard → Variables tab

## 🆘 Still Having Issues?

1. **Check Railway logs** for specific error messages
2. **Check browser console** for detailed error info
3. **Test backend URL directly** in browser
4. **Verify all environment variables** are set correctly

---

**🔧 After fixing, your EventLoo app should work perfectly!** 
# 🔗 Connect Vercel Frontend + Railway Backend

## 🎯 Current Status
- ✅ **Backend:** Railway deployed
- ✅ **Frontend:** Vercel deployed
- 🔗 **Next:** Connect them together

## 📍 Step 1: Get Your Backend URL

### **From Railway Dashboard:**
1. Go to [https://railway.app/dashboard](https://railway.app/dashboard)
2. Click on your backend project
3. Copy the **Domain URL** (e.g., `https://eventloo-backend.railway.app`)

## 📍 Step 2: Update Frontend Environment Variables

### **In Vercel Dashboard:**
1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your frontend project
3. Go to **"Settings"** → **"Environment Variables"**
4. Add/Update this variable:

```
REACT_APP_API_URL=https://your-railway-backend-url.railway.app
```

**Example:**
```
REACT_APP_API_URL=https://eventloo-backend.railway.app
```

## 📍 Step 3: Redeploy Frontend

### **After updating environment variables:**
1. Go to **"Deployments"** tab in Vercel
2. Click **"Redeploy"** on your latest deployment
3. Wait for build to complete (2-3 minutes)

## 🧪 Step 4: Test the Connection

### **Test 1: Check Frontend Loads**
1. Visit your Vercel URL
2. Should see the login page
3. No console errors

### **Test 2: Test Login**
1. Try to login with admin credentials
2. Check browser console for API calls
3. Should connect to Railway backend

### **Test 3: Check API Calls**
Open browser console and look for:
```
🔧 Making request to: /token/
🔧 Full URL: https://your-railway-backend.railway.app/api/token/
```

## 🔧 Step 5: Update Backend CORS Settings

### **In Railway Dashboard:**
1. Go to your backend project
2. **"Variables"** tab
3. Add/Update these environment variables:

```
CORS_ALLOWED_ORIGINS=https://your-vercel-frontend-url.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-vercel-frontend-url.vercel.app
```

**Example:**
```
CORS_ALLOWED_ORIGINS=https://eventloo-frontend.vercel.app
CSRF_TRUSTED_ORIGINS=https://eventloo-frontend.vercel.app
```

## 🧪 Step 6: Test Complete Connection

### **Create a test script:**
```bash
#!/bin/bash
echo "🔗 Testing Frontend + Backend Connection"

FRONTEND_URL="https://your-vercel-url.vercel.app"
BACKEND_URL="https://your-railway-backend.railway.app"

echo "Frontend: $FRONTEND_URL"
echo "Backend: $BACKEND_URL"

# Test frontend loads
echo "Testing frontend..."
curl -s "$FRONTEND_URL" > /dev/null && echo "✅ Frontend accessible" || echo "❌ Frontend not accessible"

# Test backend API
echo "Testing backend API..."
curl -s "$BACKEND_URL/api/" > /dev/null && echo "✅ Backend API accessible" || echo "❌ Backend API not accessible"

echo "🎯 Connection test complete!"
```

## 🎯 Success Indicators

✅ **Frontend loads** without errors
✅ **Login page** appears
✅ **API calls** go to Railway backend
✅ **No CORS errors** in browser console
✅ **Login works** with admin credentials
✅ **All features** (events, teams, etc.) work

## 🔧 Troubleshooting

### **Issue: CORS Errors**
**Solution:**
1. Update `CORS_ALLOWED_ORIGINS` in Railway
2. Include your exact Vercel URL
3. Redeploy backend

### **Issue: API Calls Fail**
**Solution:**
1. Check `REACT_APP_API_URL` in Vercel
2. Verify Railway backend URL is correct
3. Test backend URL directly

### **Issue: Frontend Shows Old Data**
**Solution:**
1. Clear browser cache
2. Hard refresh (Ctrl+F5)
3. Check if environment variables updated

### **Issue: Login Doesn't Work**
**Solution:**
1. Check browser console for errors
2. Verify backend is running
3. Test backend API directly

## 📱 Quick Commands

### **Test Backend:**
```bash
curl https://your-railway-backend.railway.app/api/
```

### **Test Frontend:**
```bash
curl https://your-vercel-frontend.vercel.app
```

### **Check Environment Variables:**
- **Vercel:** Dashboard → Settings → Environment Variables
- **Railway:** Dashboard → Variables tab

## 🎉 Final Result

After successful connection:
- **Frontend:** `https://your-project.vercel.app`
- **Backend:** `https://your-project.railway.app`
- **Full App:** Login, events, teams, admin panel all working

---

**🚀 Your EventLoo app is now fully connected and deployed!** 
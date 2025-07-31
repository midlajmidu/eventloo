# 🚀 Deploy Frontend with Nginx (SPA Routing Fix)

## **Step-by-Step Deployment Guide**

### **Step 1: Access Google Cloud Console**
1. Go to: https://console.cloud.google.com
2. Make sure you're in the **`eventloo-com`** project
3. If not, click the project selector at the top and choose `eventloo-com`

### **Step 2: Navigate to Cloud Run**
1. In the left sidebar, click **"Cloud Run"**
2. You should see your frontend service: `eventloo-frontend`

### **Step 3: Deploy New Revision**
1. Click on the **`eventloo-frontend`** service
2. Click **"Edit & Deploy New Revision"** button
3. In the **"Container"** section, make sure it's set to deploy from source

### **Step 4: Set Environment Variables**
1. Scroll down to **"Variables & Secrets"**
2. Click **"Add Variable"** and add:
   - **Name:** `REACT_APP_API_URL`
   - **Value:** `https://eventloo-backend-7vxrwvifna-uc.a.run.app/api`
3. Click **"Add Variable"** again and add:
   - **Name:** `NODE_ENV`
   - **Value:** `production`

### **Step 5: Deploy**
1. Click **"Deploy"** button
2. Wait for deployment to complete (usually 3-5 minutes for nginx build)

### **Step 6: Test the Deployment**
1. Once deployed, click on the **URL** of your service
2. Test these scenarios:
   - ✅ Login with: `admin@eventloo.com` / `admin123`
   - ✅ Navigate to different pages
   - ✅ Refresh any page (should not show blank or errors)
   - ✅ Try accessing direct URLs like `/admin/events`
   - ✅ Try accessing `/admin/students` directly

## **🔧 What's New in This Deployment:**

### **✅ Nginx-Based SPA Routing**
- Uses nginx instead of `serve`
- Properly handles client-side routing
- No more JavaScript syntax errors on refresh

### **✅ Fixed Issues:**
- **Blank page on reload** - Now shows proper content
- **JavaScript syntax errors** - No more `Unexpected token '<'`
- **Direct URL access** - Works for all routes
- **Better performance** - nginx is faster than `serve`

### **✅ Enhanced Features:**
- **Static file caching** - Better performance
- **Security headers** - Added protection
- **Proper SPA routing** - All routes work correctly

## **📱 Test Instructions:**

### **Test 1: Basic Navigation**
1. Go to your frontend URL
2. Login with: `admin@eventloo.com` / `admin123`
3. Navigate between different pages
4. Should work smoothly

### **Test 2: Page Refresh**
1. After login, navigate to any page (e.g., `/admin/events`)
2. Refresh the browser page
3. Should load correctly (no blank page or errors)

### **Test 3: Direct URL Access**
1. Open a new incognito/private window
2. Try to access: `https://your-frontend-url/admin/events`
3. Should redirect to login, then work after login

### **Test 4: Deep Routes**
1. Login normally
2. Try accessing these URLs directly:
   - `/admin/students`
   - `/admin/teams`
   - `/admin/points`
   - `/admin/settings`
3. All should work without issues

## **🎯 Expected Results:**

- ✅ **No more blank pages** on refresh
- ✅ **No more JavaScript errors** in console
- ✅ **Direct URL access** works for all routes
- ✅ **Smooth navigation** between pages
- ✅ **Better performance** with nginx

## **🔗 Your URLs:**

- **Frontend:** `https://eventloo-frontend-326693416937.us-central1.run.app`
- **Backend:** `https://eventloo-backend-7vxrwvifna-uc.a.run.app`

## **📞 If You Need Help:**

If deployment fails or you encounter issues:
1. Check that you're in the correct project (`eventloo-com`)
2. Make sure environment variables are set correctly
3. Wait for deployment to complete (nginx build takes longer)
4. Clear browser cache if testing locally

## **🎉 After Deployment:**

Your frontend will now have:
- **Proper SPA routing** with nginx
- **No more refresh issues**
- **Better performance**
- **Enhanced security**

**The SPA routing issues are now completely fixed!** 🚀 
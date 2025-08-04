# 🔧 **TEMPORARY FIX: Update Vercel Environment Variable**

## 🚨 **Current Issue:**
The frontend is still showing double `/api` in the URL:
```
https://eventloo-backend-qkvm.onrender.com/api/api/token/
```

## 🔧 **Immediate Fix:**

### **Update Vercel Environment Variable:**

1. **Go to:** https://vercel.com/dashboard
2. **Find your 'eventloo' project**
3. **Click on 'Settings' tab**
4. **Click on 'Environment Variables'**
5. **Update the REACT_APP_API_URL:**

| Variable Name | Current Value | New Value |
|---------------|---------------|-----------|
| `REACT_APP_API_URL` | `https://eventloo-backend-qkvm.onrender.com/api` | `https://eventloo-backend-qkvm.onrender.com` |

### **After Updating:**
1. **Go to 'Deployments' tab**
2. **Click 'Redeploy'**
3. **Wait for deployment to complete**

## 🎯 **Expected Result:**
- ✅ **Correct URL:** `https://eventloo-backend-qkvm.onrender.com/api/token/`
- ✅ **No more double `/api`**
- ✅ **Login should work**

## 🔗 **Test URLs:**
- **Frontend:** https://eventloo.vercel.app/
- **Backend:** https://eventloo-backend-qkvm.onrender.com/
- **Admin:** https://eventloo-backend-qkvm.onrender.com/admin/

**This will fix the immediate issue while the code fix deploys!** 🚀 
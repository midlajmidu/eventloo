# 🔧 **Database Setup Guide - Render PostgreSQL**

## 🚨 **Current Issue:**
Your backend is trying to connect to `localhost` instead of the Render PostgreSQL database.

**Error:** `connection to server at "localhost" (::1), port 5432 failed: Connection refused`

## ✅ **Database Status:**
- **Database ID:** `dpg-d27lkk49c44c73f5pp8g-a`
- **Database Name:** `eventloo_db`
- **Database User:** `eventloo_user`
- **Status:** ✅ Created and running
- **Plan:** Free

## 🔧 **Solution: Connect Database to Backend**

### **Step 1: Get Database Connection URL**

1. **Go to:** https://dashboard.render.com/
2. **Find your PostgreSQL database:** `eventloo-db`
3. **Click on the database service**
4. **Go to 'Connections' tab**
5. **Copy the 'External Database URL'**

The URL will look like:
```
postgres://eventloo_user:password@host:port/eventloo_db
```

### **Step 2: Add DATABASE_URL to Backend Service**

1. **Go to:** https://dashboard.render.com/
2. **Find your backend service:** `eventloo-backend-qkvm`
3. **Click on the backend service**
4. **Go to 'Environment' tab**
5. **Add new environment variable:**

| Variable Name | Value |
|---------------|-------|
| `DATABASE_URL` | `(Paste the External Database URL from Step 1)` |

### **Step 3: Redeploy Backend**

1. **Go to 'Deployments' tab**
2. **Click 'Redeploy' on your latest deployment**
3. **Wait for deployment to complete**

## 🧪 **Testing the Connection**

### **Check Backend Status:**
```bash
# Health check
curl https://eventloo-backend-qkvm.onrender.com/

# API test
curl https://eventloo-backend-qkvm.onrender.com/api/test/

# Admin panel
curl -I https://eventloo-backend-qkvm.onrender.com/admin/
```

### **Expected Results:**
- ✅ Health check returns JSON
- ✅ API endpoints respond
- ✅ Admin panel accessible
- ✅ No database connection errors in logs

## 🎯 **Admin User Creation**

Once the database is connected, the backend automatically runs migrations and starts serving requests. It never creates a default account. Provision the platform owner with `seed_super_admin --email ... --password ...`, then create each school administrator from the Super Admin portal.

## 🔗 **Database Information**

### **Render PostgreSQL Database:**
- **Service ID:** `dpg-d27lkk49c44c73f5pp8g-a`
- **Dashboard:** https://dashboard.render.com/d/dpg-d27lkk49c44c73f5pp8g-a
- **Database Name:** `eventloo_db`
- **User:** `eventloo_user`
- **Plan:** Free
- **Region:** Oregon

### **Backend Service:**
- **Service ID:** `srv-d27lriruibrs738k86a0`
- **Dashboard:** https://dashboard.render.com/web/srv-d27lriruibrs738k86a0
- **URL:** https://eventloo-backend-qkvm.onrender.com/

## 📋 **Troubleshooting**

### **If DATABASE_URL is not available:**
1. Check if the database service is running
2. Verify the database credentials
3. Try recreating the database connection

### **If migrations fail:**
1. Check the database connection string
2. Verify the database user has proper permissions
3. Check the logs for specific error messages

### **If admin user creation fails:**
1. Check if the user already exists
2. Verify the database connection
3. Check the logs for specific error messages

## 🎉 **Success Indicators**

### **Backend Working:**
- ✅ Health check returns: `{"status": "healthy", "service": "eventloo-backend"}`
- ✅ API test returns: `{"message": "API is working", "endpoints": ["accounts", "events"]}`
- ✅ Admin panel accessible at: https://eventloo-backend-qkvm.onrender.com/admin/

### **Database Connected:**
- ✅ No "connection refused" errors in logs
- ✅ Migrations run successfully
- ✅ Admin user created successfully
- ✅ All API endpoints working

---

## 🚀 **Ready to Connect!**

**Your PostgreSQL database is ready and waiting to be connected to your backend!**

**Follow the steps above to add the DATABASE_URL environment variable and your backend will be fully operational with persistent data storage!** 🎯 

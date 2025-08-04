# 🚀 Render.com Deployment Guide - Eventloo

## ✅ **Project Preparation Complete:**

### **1. Requirements.txt ✅**
```txt
Django==4.2.7
gunicorn==21.2.0
whitenoise==6.6.0
dj-database-url==2.1.0
psycopg2-binary==2.9.9
python-decouple==3.8
django-cors-headers==4.3.1
djangorestframework==3.14.0
djangorestframework-simplejwt==5.3.0
django-filter==23.3
Pillow==10.1.0
reportlab==4.0.7
```

### **2. Start Script ✅**
```bash
#!/bin/bash

echo "Starting Django backend"

# Change to backend directory
cd backend

# Run database migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Create admin user
echo "Creating admin user..."
python manage.py create_admin_user

# Start Gunicorn server
echo "Starting Gunicorn server..."
exec gunicorn event_management.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers 1 \
    --threads 4 \
    --timeout 300
```

### **3. Procfile ✅**
```procfile
web: cd backend && python manage.py migrate --noinput && python manage.py collectstatic --noinput && python manage.py create_admin_user && gunicorn event_management.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 300
```

### **4. Executable Permissions ✅**
```bash
chmod +x start.sh
```

## 🚀 **Deployment Steps:**

### **Step 1: Create Render Account**
1. Go to [Render.com](https://render.com)
2. Sign up with GitHub
3. Connect your GitHub repository

### **Step 2: Create New Web Service**
1. Click **"New"** → **"Web Service"**
2. Connect your GitHub repository: `midlajmidu/eventloo`
3. Configure the service:

### **Step 3: Service Configuration**
```
Name: eventloo-backend
Root Directory: / (leave empty for root)
Runtime: Python 3
Build Command: pip install -r backend/requirements.txt
Start Command: ./start.sh
```

### **Step 4: Environment Variables**
Add these environment variables in Render dashboard:

```
DEBUG=False
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=eventloo-backend.onrender.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://eventloo.vercel.app,http://localhost:3000
CSRF_TRUSTED_ORIGINS=https://eventloo.vercel.app,http://localhost:3000
```

### **Step 5: Database Setup**
1. Create a **PostgreSQL** database in Render
2. Copy the **Internal Database URL**
3. Add as environment variable:
```
DATABASE_URL=postgres://user:password@host:port/database
```

## 🧪 **Testing Deployment:**

### **Health Check:**
```bash
curl https://eventloo-backend.onrender.com/
```

### **Expected Response:**
```json
{
  "status": "healthy",
  "service": "eventloo-backend",
  "timestamp": "2025-08-03T..."
}
```

### **API Test:**
```bash
curl https://eventloo-backend.onrender.com/api/test/
```

### **Admin Panel:**
- URL: `https://eventloo-backend.onrender.com/admin/`
- Email: `admin@eventloo.com`
- Password: `admin123`

## 📋 **Deployment Checklist:**

- [ ] ✅ Requirements.txt created with all packages
- [ ] ✅ Start script created and executable
- [ ] ✅ Procfile created as alternative
- [ ] ✅ Settings.py configured for production
- [ ] ✅ CORS settings updated for Render
- [ ] ✅ Static files configuration
- [ ] ✅ Database configuration
- [ ] ✅ Environment variables set
- [ ] ✅ Build command configured
- [ ] ✅ Start command configured

## 🚨 **Troubleshooting:**

### **Common Issues:**

1. **Build Fails:**
   - Check requirements.txt syntax
   - Verify all packages are available
   - Check Python version compatibility

2. **Startup Fails:**
   - Verify start.sh is executable
   - Check environment variables
   - Review Render logs for specific errors

3. **Database Connection:**
   - Verify DATABASE_URL is correct
   - Check PostgreSQL service is running
   - Ensure database exists

4. **Static Files:**
   - Check STATIC_ROOT configuration
   - Verify whitenoise middleware
   - Review collectstatic output

## 🎯 **Expected Results:**

### **Successful Deployment:**
- ✅ **Service Status:** Live
- ✅ **Health Check:** 200 OK
- ✅ **Database:** Connected
- ✅ **Admin User:** Created
- ✅ **API Endpoints:** Responding
- ✅ **Static Files:** Served

### **Performance:**
- ✅ **Response Time:** < 2 seconds
- ✅ **Memory Usage:** < 512MB
- ✅ **CPU Usage:** < 50%

## 🎉 **Next Steps:**

1. **Test the API endpoints**
2. **Verify admin panel access**
3. **Update frontend configuration**
4. **Deploy frontend to Vercel**
5. **Test complete application**

---

**🎯 Your Django backend is now ready for Render deployment!**

**All files have been created and configured according to the specifications.** 
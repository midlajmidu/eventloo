# 🌍 Environment Variables Guide for Eventloo

## 📋 **Required Environment Variables**

### **Core Django Settings**
```env
SECRET_KEY=your-super-secret-key-here-change-this-in-production
DEBUG=False
DJANGO_SETTINGS_MODULE=event_management.settings
```

### **Database Configuration**
```env
# For SQLite (local development)
DATABASE_URL=sqlite:///db.sqlite3

# For PostgreSQL (production)
DATABASE_URL=postgresql://username:password@host:port/database_name
```

### **Host Configuration**
```env
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com,your-app.onrender.com,your-app.railway.app
```

### **CORS Settings**
```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,https://your-frontend-domain.com
```

### **Static Files Configuration**
```env
STATIC_URL=/static/
STATIC_ROOT=/app/staticfiles
MEDIA_URL=/media/
MEDIA_ROOT=/app/media
```

### **Python Version**
```env
PYTHON_VERSION=3.11.9
```

---

## 🚀 **Platform-Specific Variables**

### **For Google Cloud Build**
```env
SECRET_KEY=your-super-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-app-url.run.app,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
DATABASE_URL=postgresql://username:password@host:port/database_name
STATIC_URL=/static/
STATIC_ROOT=/app/staticfiles
MEDIA_URL=/media/
MEDIA_ROOT=/app/media
```

### **For Railway**
```env
SECRET_KEY=your-super-secret-key-here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,.railway.app,.up.railway.app
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://your-frontend-app.railway.app
RAILWAY_FRONTEND_URL=https://your-frontend-app.railway.app
DATABASE_URL=postgresql://... (Railway auto-sets this)
STATIC_URL=/static/
STATIC_ROOT=/app/staticfiles
MEDIA_URL=/media/
MEDIA_ROOT=/app/media
```

### **For Render**
```env
SECRET_KEY=your-super-secret-key-here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-app.onrender.com
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://your-frontend-app.onrender.com
DATABASE_URL=postgresql://... (Render auto-sets this)
STATIC_URL=/static/
STATIC_ROOT=/app/staticfiles
MEDIA_URL=/media/
MEDIA_ROOT=/app/media
```

---

## 🔐 **Security Variables**

### **JWT Settings (Optional)**
```env
JWT_ACCESS_TOKEN_LIFETIME=60
JWT_REFRESH_TOKEN_LIFETIME=1440
```

### **File Upload Limits**
```env
DATA_UPLOAD_MAX_MEMORY_SIZE=104857600
FILE_UPLOAD_MAX_MEMORY_SIZE=104857600
```

### **Security Headers**
```env
SECURE_BROWSER_XSS_FILTER=True
SECURE_CONTENT_TYPE_NOSNIFF=True
X_FRAME_OPTIONS=DENY
```

---

## 📧 **Email Configuration (Optional)**
```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

---

## 📝 **How to Use**

### **1. Local Development**
Create a `.env` file in the `backend/` directory:
```bash
cd backend
cp .env.example .env
# Edit .env with your local values
```

### **2. Production Deployment**
Set these variables in your deployment platform:
- **Google Cloud**: Environment variables in Cloud Run
- **Railway**: Environment variables in Railway dashboard
- **Render**: Environment variables in Render dashboard

### **3. Generate Secret Key**
```python
# Run this in Python to generate a secure secret key
import secrets
print(secrets.token_urlsafe(50))
```

---

## ⚠️ **Important Notes**

1. **Never commit `.env` files** to version control
2. **Use different secret keys** for development and production
3. **Set DEBUG=False** in production
4. **Use HTTPS URLs** for CORS in production
5. **Use strong database passwords** in production

---

## 🔄 **Quick Setup Commands**

```bash
# Generate a secret key
python -c "import secrets; print(secrets.token_urlsafe(50))"

# Create .env file (local development)
cd backend
echo "SECRET_KEY=your-generated-secret-key" > .env
echo "DEBUG=True" >> .env
echo "ALLOWED_HOSTS=localhost,127.0.0.1" >> .env
echo "CORS_ALLOWED_ORIGINS=http://localhost:3000" >> .env
``` 
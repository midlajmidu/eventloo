# Eventloo Render Deployment Guide

## 🚀 Deploy to Render (Free Tier)

### Prerequisites ✅
- GitHub repository with your code (already done)
- Render account (free tier available)

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Verify your email

### Step 2: Deploy Backend (Django)
1. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `midlajmidu/eventloo`
   - Name: `eventloo-backend`

2. **Configure Backend Service**
   - **Environment:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `cd backend && python manage.py migrate && gunicorn event_management.wsgi:application --bind 0.0.0.0:$PORT`

3. **Environment Variables**
   ```
   PYTHON_VERSION=3.9.16
   DJANGO_SETTINGS_MODULE=event_management.settings
   DEBUG=False
   ALLOWED_HOSTS=.onrender.com
   CORS_ALLOWED_ORIGINS=https://eventloo-frontend.onrender.com
   SECRET_KEY=[Render will generate this]
   STATIC_URL=/static/
   STATIC_ROOT=/opt/render/project/src/backend/staticfiles
   MEDIA_URL=/media/
   MEDIA_ROOT=/opt/render/project/src/backend/media
   ```

### Step 3: Create Database
1. **Create PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - Name: `eventloo-db`
   - Plan: Free
   - Copy the **Internal Database URL**

2. **Add Database URL to Backend**
   - Go back to your backend service
   - Add environment variable:
   ```
   DATABASE_URL=[paste the internal database URL from step 1]
   ```

### Step 4: Deploy Frontend (React)
1. **Create New Static Site**
   - Click "New +" → "Static Site"
   - Connect your GitHub repository: `midlajmidu/eventloo`
   - Name: `eventloo-frontend`

2. **Configure Frontend Service**
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Publish Directory:** `frontend/build`

3. **Environment Variables**
   ```
   REACT_APP_API_URL=https://eventloo-backend.onrender.com/api
   GENERATE_SOURCEMAP=false
   ```

### Step 5: Update CORS Settings
1. **Get Frontend URL**
   - After frontend deploys, copy the URL (e.g., `https://eventloo-frontend.onrender.com`)

2. **Update Backend CORS**
   - Go to backend service settings
   - Update `CORS_ALLOWED_ORIGINS` to include your frontend URL

### Step 6: Final Configuration
1. **Create Superuser**
   - Go to backend service logs
   - Run: `python manage.py createsuperuser`

2. **Test Your Application**
   - Visit your frontend URL
   - Test login and functionality

## 🔧 Troubleshooting

### Common Issues:
1. **Build Fails**
   - Check requirements.txt is in root directory
   - Verify Python version compatibility

2. **Database Connection**
   - Ensure DATABASE_URL is set correctly
   - Check if database is created and running

3. **CORS Errors**
   - Verify CORS_ALLOWED_ORIGINS includes your frontend URL
   - Check frontend API_URL is correct

4. **Static Files**
   - Ensure STATIC_ROOT and MEDIA_ROOT are set
   - Run `python manage.py collectstatic` if needed

## 📝 Important Notes

- **Free Tier Limitations:**
  - Services sleep after 15 minutes of inactivity
  - 750 hours/month free
  - 512MB RAM per service

- **Environment Variables:**
  - Keep SECRET_KEY secure
  - Use production settings (DEBUG=False)

- **Database:**
  - Free PostgreSQL has 1GB storage
  - Automatic backups included

## 🎉 Success!
Your Eventloo application is now deployed on Render!
- Backend: `https://eventloo-backend.onrender.com`
- Frontend: `https://eventloo-frontend.onrender.com` 
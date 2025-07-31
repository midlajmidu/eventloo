# Eventloo Deployment Guide

## 🚀 Quick Deployment Options

### Option 1: Google Cloud Build (Recommended)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to Cloud Build > Triggers
3. Create a new trigger or use existing one
4. Use the `deploy-via-cloudbuild.yaml` configuration
5. This will deploy both backend and frontend with fixed settings

### Option 2: Manual Cloud Run Deployment
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to Cloud Run
3. Deploy backend with these environment variables:
   ```
   DEBUG=False
   DJANGO_SETTINGS_MODULE=event_management.settings
   SECRET_KEY=eventloo-production-secret-key-2024-change-this-in-production
   ALLOWED_HOSTS=localhost,127.0.0.1,eventloo-backend-7vxrwvifna-uc.a.run.app
   CORS_ALLOWED_ORIGINS=https://eventloo-frontend-326693416937.us-central1.run.app
   DATABASE_URL=postgresql://eventloo_user:eventloo_secure_password_2024@/eventloo_db?host=/cloudsql/eventloo:us-central1:eventloo-instance
   ```
4. Deploy frontend with these environment variables:
   ```
   REACT_APP_API_URL=https://eventloo-backend-7vxrwvifna-uc.a.run.app/api
   NODE_ENV=production
   ```

### Option 3: GitHub Actions (If you have gcloud CLI)
1. Push to GitHub (already done)
2. Set up GitHub Actions workflow
3. Use the deployment scripts in the repository

## 🔧 Fixed Configuration Details

### Backend Configuration
- **Service Name**: `eventloo-backend`
- **Region**: `us-central1`
- **Port**: `8080`
- **Memory**: `1Gi`
- **CPU**: `1`
- **Database Password**: `eventloo_secure_password_2024` (fixed)
- **SECRET_KEY**: `eventloo-production-secret-key-2024-change-this-in-production` (fixed)

### Frontend Configuration
- **Service Name**: `eventloo-frontend`
- **Region**: `us-central1`
- **Port**: `80`
- **Memory**: `512Mi`
- **CPU**: `1`
- **API URL**: `https://eventloo-backend-7vxrwvifna-uc.a.run.app/api` (fixed)

### Database Configuration
- **Instance**: `eventloo-instance`
- **Database**: `eventloo_db`
- **User**: `eventloo_user`
- **Password**: `eventloo_secure_password_2024` (fixed)

## 🔐 Login Credentials
- **Email**: `admin@eventloo.com`
- **Password**: `admin123`

## ✅ What's Fixed
1. **Database Password Persistence**: No more random password generation
2. **SECRET_KEY Consistency**: Same key across deployments
3. **API URL Configuration**: Frontend connects to correct backend
4. **Data Persistence**: Your data will survive deployments
5. **Login Issues**: Resolved permanently

## 🚨 Important Notes
- **Always use the fixed configuration** to prevent data loss
- **Save the database password**: `eventloo_secure_password_2024`
- **Don't change the SECRET_KEY** unless absolutely necessary
- **Test login after deployment** with admin credentials

## 🔍 Testing After Deployment
1. Visit your frontend URL
2. Try logging in with: `admin@eventloo.com` / `admin123`
3. If login fails, run: `./test-current-login.sh`
4. Check the browser console for any errors

## 📞 Support
If you encounter issues:
1. Run the test scripts to diagnose problems
2. Check the deployment logs in Google Cloud Console
3. Verify the environment variables are set correctly
4. Ensure the database connection is working 
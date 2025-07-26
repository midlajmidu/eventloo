# 🚀 Eventloo Google Cloud Deployment Guide

This guide will help you deploy your Django + React application to Google Cloud Run with Cloud SQL PostgreSQL database.

## 📋 Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud CLI (gcloud)** installed and configured
3. **Docker** installed (optional, for local testing)
4. **Git** for version control

## 🛠️ Setup Steps

### 1. Install Google Cloud CLI

```bash
# macOS
brew install google-cloud-sdk

# Ubuntu/Debian
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
echo "deb https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
sudo apt-get update && sudo apt-get install google-cloud-sdk

# Windows
# Download from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud auth application-default login
```

### 3. Set Your Project ID

Edit the deployment scripts and replace `your-project-id` with your actual Google Cloud project ID:

```bash
# In deploy.sh and setup-database.sh, change:
PROJECT_ID="your-project-id"
# to:
PROJECT_ID="your-actual-project-id"
```

## 🗄️ Database Setup

### Option 1: Automated Setup (Recommended)

```bash
# Make the script executable
chmod +x setup-database.sh

# Run the database setup
./setup-database.sh
```

### Option 2: Manual Setup

1. **Create Cloud SQL Instance:**
```bash
gcloud sql instances create eventloo-instance \
    --database-version=POSTGRES_14 \
    --tier=db-f1-micro \
    --region=us-central1 \
    --storage-type=SSD \
    --storage-size=10GB
```

2. **Create Database:**
```bash
gcloud sql databases create eventloo_db --instance=eventloo-instance
```

3. **Create Database User:**
```bash
gcloud sql users create eventloo_user \
    --instance=eventloo-instance \
    --password=your-secure-password
```

## 🚀 Deploy to Cloud Run

### Option 1: Automated Deployment (Recommended)

```bash
# Make the script executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

### Option 2: Manual Deployment

1. **Build and Deploy:**
```bash
gcloud run deploy eventloo \
    --source . \
    --region=us-central1 \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=1Gi \
    --cpu=1 \
    --max-instances=10 \
    --timeout=300
```

2. **Set Environment Variables:**
```bash
gcloud run services update eventloo \
    --region=us-central1 \
    --set-env-vars="DEBUG=False,DJANGO_SETTINGS_MODULE=event_management.settings,DATABASE_URL=your-database-url,SECRET_KEY=your-secret-key"
```

## 🔧 Configuration

### Environment Variables

Copy `env.production.template` to `.env.production` and fill in your values:

```bash
cp env.production.template .env.production
```

Key variables to configure:
- `SECRET_KEY`: Generate a secure Django secret key
- `DATABASE_URL`: Your Cloud SQL connection string
- `ALLOWED_HOSTS`: Your Cloud Run service URL
- `CORS_ALLOWED_ORIGINS`: Your frontend URL

### Custom Domain (Optional)

1. **Map Custom Domain:**
```bash
gcloud run domain-mappings create \
    --service=eventloo \
    --domain=your-domain.com \
    --region=us-central1
```

2. **Update DNS Records:**
Add a CNAME record pointing to your Cloud Run service URL.

## 📊 Monitoring and Logs

### View Logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=eventloo" --limit=50
```

### Monitor Performance
- Go to Google Cloud Console → Cloud Run → eventloo
- Check the "Metrics" tab for performance data

## 🔄 CI/CD with Cloud Build

### Setup Automated Deployment

1. **Connect Repository:**
   - Go to Cloud Build → Triggers
   - Connect your GitHub repository

2. **Create Trigger:**
   - Source: Your repository
   - Branch: main
   - Build configuration: Use `cloudbuild.yaml`

3. **Automatic Deployment:**
   - Every push to main will trigger deployment
   - Build logs available in Cloud Build console

## 🛡️ Security Best Practices

### 1. Environment Variables
- Never commit secrets to version control
- Use Google Secret Manager for sensitive data
- Rotate secrets regularly

### 2. Database Security
- Use Cloud SQL Proxy for local development
- Enable SSL connections
- Restrict database access with IAM

### 3. Application Security
- Keep dependencies updated
- Enable security headers
- Use HTTPS only in production

## 🔍 Troubleshooting

### Common Issues

1. **Container Fails to Start:**
   - Check logs: `gcloud run services logs read eventloo --region=us-central1`
   - Verify environment variables
   - Check database connectivity

2. **Database Connection Issues:**
   - Verify Cloud SQL instance is running
   - Check connection string format
   - Ensure proper IAM permissions

3. **Static Files Not Loading:**
   - Verify `STATIC_ROOT` is set correctly
   - Check WhiteNoise configuration
   - Ensure build files are copied correctly

### Debug Commands

```bash
# Check service status
gcloud run services describe eventloo --region=us-central1

# View recent logs
gcloud run services logs read eventloo --region=us-central1 --limit=100

# Test database connection
gcloud sql connect eventloo-instance --user=eventloo_user

# Check environment variables
gcloud run services describe eventloo --region=us-central1 --format="value(spec.template.spec.containers[0].env[].name,spec.template.spec.containers[0].env[].value)"
```

## 📈 Scaling and Performance

### Resource Limits
- **Memory:** 1Gi (adjust based on needs)
- **CPU:** 1 vCPU (adjust based on needs)
- **Max Instances:** 10 (adjust based on traffic)

### Performance Optimization
- Enable Cloud CDN for static files
- Use connection pooling for database
- Implement caching strategies
- Monitor and optimize queries

## 💰 Cost Optimization

### Free Tier
- Cloud Run: 2 million requests/month
- Cloud SQL: db-f1-micro instance
- Cloud Build: 120 build-minutes/day

### Cost Monitoring
- Set up billing alerts
- Monitor resource usage
- Use cost optimization recommendations

## 📞 Support

For issues specific to your deployment:
1. Check the troubleshooting section above
2. Review Google Cloud documentation
3. Check application logs for errors
4. Verify configuration settings

## 🎉 Success!

Once deployed, your application will be available at:
`https://eventloo-[region]-[project-id].a.run.app`

The deployment includes:
- ✅ Django backend with REST API
- ✅ React frontend with routing
- ✅ PostgreSQL database
- ✅ Static file serving
- ✅ HTTPS and security headers
- ✅ Automatic scaling
- ✅ Monitoring and logging 
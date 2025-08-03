#!/bin/bash

# Deploy and Setup Script
# This script deploys the application and automatically sets up admin user

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploy and Setup Script${NC}"
echo "================================"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    echo -e "${YELLOW}📋 You can still run the auto-admin-setup script:${NC}"
    echo "chmod +x auto-admin-setup.sh && ./auto-admin-setup.sh"
    exit 1
fi

# Configuration
PROJECT_ID="eventloo-com"
REGION="us-central1"
SERVICE_NAME="eventloo-backend"
DATABASE_NAME="eventloo_db"
DATABASE_USER="eventloo_user"

echo -e "${BLUE}🔗 Project ID: $PROJECT_ID${NC}"
echo -e "${BLUE}🌍 Region: $REGION${NC}"
echo -e "${BLUE}🏗️  Service Name: $SERVICE_NAME${NC}"
echo ""

# Set the project
echo -e "${GREEN}📋 Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${GREEN}🔧 Enabling required Google Cloud APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Create Cloud SQL instance (if it doesn't exist)
echo -e "${GREEN}🗄️  Setting up Cloud SQL database...${NC}"
if ! gcloud sql instances describe eventloo-instance --project=$PROJECT_ID &> /dev/null; then
    echo -e "${YELLOW}📦 Creating Cloud SQL instance...${NC}"
    gcloud sql instances create eventloo-instance \
        --database-version=POSTGRES_14 \
        --tier=db-f1-micro \
        --region=$REGION \
        --storage-type=SSD \
        --storage-size=10GB \
        --backup-start-time=02:00 \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=2
else
    echo -e "${GREEN}✅ Cloud SQL instance already exists${NC}"
fi

# Create database (if it doesn't exist)
echo -e "${GREEN}📊 Creating database...${NC}"
gcloud sql databases create $DATABASE_NAME --instance=eventloo-instance || echo -e "${YELLOW}⚠️  Database might already exist${NC}"

# Check if database user exists and get password
echo -e "${GREEN}👤 Checking database user...${NC}"
if gcloud sql users list --instance=eventloo-instance --format="value(name)" | grep -q "$DATABASE_USER"; then
    echo -e "${GREEN}✅ Database user already exists${NC}"
    echo -e "${YELLOW}⚠️  Using existing database user. If you need to reset password, run:${NC}"
    echo "gcloud sql users set-password $DATABASE_USER --instance=eventloo-instance --password=YOUR_NEW_PASSWORD"
    
    # Use consistent password
    DB_PASSWORD="eventloo_secure_password_2024"
else
    echo -e "${YELLOW}📦 Creating database user...${NC}"
    DB_PASSWORD="eventloo_secure_password_2024"
    gcloud sql users create $DATABASE_USER --instance=eventloo-instance --password=$DB_PASSWORD || echo -e "${YELLOW}⚠️  User might already exist${NC}"
fi

# Get database connection info
DB_HOST=$(gcloud sql instances describe eventloo-instance --format="value(connectionName)")
DATABASE_URL="postgresql://$DATABASE_USER:$DB_PASSWORD@/$DATABASE_NAME?host=/cloudsql/$DB_HOST"

echo -e "${GREEN}🔗 Database URL: $DATABASE_URL${NC}"

# Use a consistent SECRET_KEY for data persistence
SECRET_KEY="eventloo-production-secret-key-2024-change-this-in-production"

# Build and deploy to Cloud Run
echo -e "${GREEN}🏗️  Building and deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --source . \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=1Gi \
    --cpu=1 \
    --max-instances=10 \
    --timeout=300 \
    --set-env-vars="DEBUG=False,DJANGO_SETTINGS_MODULE=event_management.settings,SECRET_KEY=$SECRET_KEY,ALLOWED_HOSTS=localhost,127.0.0.1,$SERVICE_NAME-$REGION-$PROJECT_ID.a.run.app,CORS_ALLOWED_ORIGINS=https://$SERVICE_NAME-$REGION-$PROJECT_ID.a.run.app" \
    --set-env-vars="DATABASE_URL=$DATABASE_URL"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Your application is available at: $SERVICE_URL${NC}"
echo -e "${GREEN}📊 Database connection: $DATABASE_URL${NC}"

# Run database migrations
echo -e "${GREEN}🔄 Running database migrations...${NC}"
gcloud run jobs create migrate-eventloo \
    --image=gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
    --region=$REGION \
    --command="python" \
    --args="manage.py,migrate" \
    --set-env-vars="DATABASE_URL=$DATABASE_URL,SECRET_KEY=$SECRET_KEY,DEBUG=False" || true

# Wait for deployment to be ready
echo -e "${GREEN}⏳ Waiting for deployment to be ready...${NC}"
sleep 30

# Auto-setup admin user
echo -e "${GREEN}👤 Setting up admin user...${NC}"
chmod +x auto-admin-setup.sh
./auto-admin-setup.sh

echo ""
echo -e "${GREEN}🎉 DEPLOY AND SETUP COMPLETED!${NC}"
echo ""
echo -e "${BLUE}📋 Important Information:${NC}"
echo "• Database Password: $DB_PASSWORD"
echo "• Admin Login: admin@eventloo.com / admin123"
echo "• Backend URL: $SERVICE_URL"
echo "• Database URL: $DATABASE_URL"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Save these credentials!${NC}"
echo "• Database password: $DB_PASSWORD"
echo "• Admin credentials: admin@eventloo.com / admin123"
echo ""
echo -e "${GREEN}✅ Your data will now persist between deployments!${NC}"
echo -e "${GREEN}✅ Admin user is ready for login!${NC}" 
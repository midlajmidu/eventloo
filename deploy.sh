#!/bin/bash

# Eventloo Google Cloud Deployment Script
# This script deploys the Django + React application to Google Cloud Run

set -e  # Exit on any error

# Configuration
PROJECT_ID="eventloo"  # Your Google Cloud project ID
REGION="us-central1"
SERVICE_NAME="eventloo"
DATABASE_NAME="eventloo_db"
DATABASE_USER="eventloo_user"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Eventloo deployment to Google Cloud...${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}⚠️  You are not authenticated with gcloud. Please run: gcloud auth login${NC}"
    exit 1
fi

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
        --maintenance-window-hour=02:00
else
    echo -e "${GREEN}✅ Cloud SQL instance already exists${NC}"
fi

# Create database (if it doesn't exist)
echo -e "${GREEN}📊 Creating database...${NC}"
gcloud sql databases create $DATABASE_NAME --instance=eventloo-instance || echo -e "${YELLOW}⚠️  Database might already exist${NC}"

# Create database user (if it doesn't exist)
echo -e "${GREEN}👤 Creating database user...${NC}"
DB_PASSWORD=$(openssl rand -base64 32)
gcloud sql users create $DATABASE_USER --instance=eventloo-instance --password=$DB_PASSWORD || echo -e "${YELLOW}⚠️  User might already exist${NC}"

# Get database connection info
DB_HOST=$(gcloud sql instances describe eventloo-instance --format="value(connectionName)")
DATABASE_URL="postgresql://$DATABASE_USER:$DB_PASSWORD@/$DATABASE_NAME?host=/cloudsql/$DB_HOST"

echo -e "${GREEN}🔗 Database URL: $DATABASE_URL${NC}"

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
    --set-env-vars="DEBUG=False,DJANGO_SETTINGS_MODULE=event_management.settings,DATABASE_URL=$DATABASE_URL,SECRET_KEY=$(openssl rand -base64 50),ALLOWED_HOSTS=localhost,127.0.0.1,$SERVICE_NAME-$REGION-$PROJECT_ID.a.run.app,CORS_ALLOWED_ORIGINS=https://$SERVICE_NAME-$REGION-$PROJECT_ID.a.run.app"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Your application is available at: $SERVICE_URL${NC}"
echo -e "${GREEN}📊 Database connection: $DATABASE_URL${NC}"
echo -e "${YELLOW}⚠️  Don't forget to save the database password: $DB_PASSWORD${NC}"

# Run database migrations
echo -e "${GREEN}🔄 Running database migrations...${NC}"
gcloud run jobs create migrate-eventloo \
    --image=gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
    --region=$REGION \
    --command="python" \
    --args="manage.py,migrate" \
    --set-env-vars="DATABASE_URL=$DATABASE_URL,SECRET_KEY=$(openssl rand -base64 50),DEBUG=False" || true

echo -e "${GREEN}🎉 Deployment script completed!${NC}" 
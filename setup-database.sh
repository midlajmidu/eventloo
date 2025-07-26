#!/bin/bash

# Database Setup Script for Eventloo
# This script sets up Cloud SQL PostgreSQL database

set -e

# Configuration
PROJECT_ID="your-project-id"  # Replace with your Google Cloud project ID
REGION="us-central1"
INSTANCE_NAME="eventloo-instance"
DATABASE_NAME="eventloo_db"
DATABASE_USER="eventloo_user"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🗄️  Setting up Cloud SQL database for Eventloo...${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set the project
gcloud config set project $PROJECT_ID

# Enable SQL Admin API
echo -e "${GREEN}🔧 Enabling SQL Admin API...${NC}"
gcloud services enable sqladmin.googleapis.com

# Create Cloud SQL instance
echo -e "${GREEN}📦 Creating Cloud SQL instance...${NC}"
if ! gcloud sql instances describe $INSTANCE_NAME --project=$PROJECT_ID &> /dev/null; then
    gcloud sql instances create $INSTANCE_NAME \
        --database-version=POSTGRES_14 \
        --tier=db-f1-micro \
        --region=$REGION \
        --storage-type=SSD \
        --storage-size=10GB \
        --backup-start-time=02:00 \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=02:00 \
        --availability-type=zonal \
        --storage-auto-increase
    
    echo -e "${GREEN}✅ Cloud SQL instance created successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Cloud SQL instance already exists${NC}"
fi

# Create database
echo -e "${GREEN}📊 Creating database...${NC}"
gcloud sql databases create $DATABASE_NAME --instance=$INSTANCE_NAME || echo -e "${YELLOW}⚠️  Database might already exist${NC}"

# Create database user
echo -e "${GREEN}👤 Creating database user...${NC}"
DB_PASSWORD=$(openssl rand -base64 32)
gcloud sql users create $DATABASE_USER --instance=$INSTANCE_NAME --password=$DB_PASSWORD || echo -e "${YELLOW}⚠️  User might already exist${NC}"

# Get connection info
DB_HOST=$(gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)")
DATABASE_URL="postgresql://$DATABASE_USER:$DB_PASSWORD@/$DATABASE_NAME?host=/cloudsql/$DB_HOST"

echo -e "${GREEN}✅ Database setup completed!${NC}"
echo -e "${GREEN}🔗 Database URL: $DATABASE_URL${NC}"
echo -e "${YELLOW}⚠️  Save this password: $DB_PASSWORD${NC}"
echo -e "${GREEN}📋 Connection name: $DB_HOST${NC}"

# Create a .env file with database info
cat > .env.database << EOF
# Database Configuration
DATABASE_URL=$DATABASE_URL
DB_HOST=$DB_HOST
DB_NAME=$DATABASE_NAME
DB_USER=$DATABASE_USER
DB_PASSWORD=$DB_PASSWORD
EOF

echo -e "${GREEN}📄 Database configuration saved to .env.database${NC}" 
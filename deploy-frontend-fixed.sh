#!/bin/bash

# Frontend Deployment Script with Fixed Backend URL
# This script deploys the frontend with the correct backend configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Frontend with Fixed Backend URL${NC}"
echo "=================================================="

# Configuration
PROJECT_ID="eventloo"
REGION="us-central1"
FRONTEND_SERVICE="eventloo-frontend"

# Correct Backend URL
BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
echo -e "${BLUE}🔗 Backend API URL: $BACKEND_URL/api${NC}"
echo ""

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

# Build and deploy frontend
echo -e "${GREEN}🏗️  Building and deploying frontend...${NC}"
cd frontend

# Build the React app
echo -e "${BLUE}📦 Building React app...${NC}"
npm run build

# Deploy to Cloud Run
echo -e "${BLUE}🚀 Deploying to Cloud Run...${NC}"
gcloud run deploy $FRONTEND_SERVICE \
    --source . \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --port=80 \
    --memory=512Mi \
    --cpu=1 \
    --max-instances=10 \
    --timeout=300 \
    --set-env-vars="REACT_APP_API_URL=$BACKEND_URL/api" \
    --set-env-vars="NODE_ENV=production"

cd ..

# Get the frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region=$REGION --format="value(status.url)")

echo -e "${GREEN}✅ Frontend deployment completed!${NC}"
echo -e "${GREEN}🌐 Frontend URL: $FRONTEND_URL${NC}"
echo -e "${GREEN}🔗 Backend API URL: $BACKEND_URL/api${NC}"
echo ""
echo -e "${BLUE}📋 Test Information:${NC}"
echo "• Frontend URL: $FRONTEND_URL"
echo "• Backend URL: $BACKEND_URL"
echo "• Admin Login: admin@eventloo.com / admin123"
echo ""
echo -e "${GREEN}🎉 Your frontend is now configured with the correct backend URL!${NC}"
echo -e "${YELLOW}⚠️  The login should now work properly.${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Visit your frontend URL: $FRONTEND_URL"
echo "2. Try logging in with: admin@eventloo.com / admin123"
echo "3. The login should work without any issues" 
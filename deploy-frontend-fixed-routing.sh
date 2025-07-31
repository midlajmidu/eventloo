#!/bin/bash

# Deploy Frontend with Fixed Routing
# This script deploys the frontend with proper routing configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Frontend with Fixed Routing${NC}"
echo "=============================================="

# Configuration
PROJECT_ID="eventloo-com"
REGION="us-central1"
FRONTEND_SERVICE="eventloo-frontend"
BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo -e "${BLUE}📋 Project: $PROJECT_ID${NC}"
echo -e "${BLUE}🌍 Region: $REGION${NC}"
echo -e "${BLUE}🌐 Frontend Service: $FRONTEND_SERVICE${NC}"
echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    echo -e "${YELLOW}Please install gcloud CLI first:${NC}"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}⚠️  You are not authenticated with gcloud${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set the project
echo -e "${GREEN}📋 Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Build and deploy frontend
echo -e "${GREEN}🏗️  Building and deploying frontend...${NC}"
cd frontend

# Install dependencies if needed
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

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
    --set-env-vars="REACT_APP_API_URL=$BACKEND_URL/api,NODE_ENV=production"

cd ..

# Get the frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region=$REGION --format="value(status.url)")

echo -e "${GREEN}✅ Frontend deployment completed!${NC}"
echo -e "${GREEN}🌐 Frontend URL: $FRONTEND_URL${NC}"
echo -e "${GREEN}🔗 Backend API URL: $BACKEND_URL/api${NC}"
echo ""
echo -e "${BLUE}📋 What's Fixed:${NC}"
echo "• ✅ Blank page on reload issue resolved"
echo "• ✅ Proper authentication redirects"
echo "• ✅ Loading states for better UX"
echo "• ✅ Redirect to login when not authenticated"
echo "• ✅ Remember intended destination after login"
echo ""
echo -e "${GREEN}🔐 Login Credentials:${NC}"
echo "• Email: admin@eventloo.com"
echo "• Password: admin123"
echo ""
echo -e "${YELLOW}📱 Test Instructions:${NC}"
echo "1. Visit: $FRONTEND_URL"
echo "2. Try logging in with the credentials above"
echo "3. Navigate to different pages"
echo "4. Try refreshing the page - it should work now!"
echo "5. Try accessing a protected route without login - should redirect to login"
echo ""
echo -e "${GREEN}🎉 Your frontend routing is now fixed!${NC}" 
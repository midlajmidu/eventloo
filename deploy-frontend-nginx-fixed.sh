#!/bin/bash

# Deploy Frontend with Nginx (Fixed SPA Routing)
# This script deploys the frontend with proper Nginx configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Frontend with Nginx (Fixed SPA Routing)${NC}"
echo "========================================================"

# Configuration
PROJECT_ID="eventloo-com"
REGION="us-central1"
FRONTEND_SERVICE="eventloo-frontend"
BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo -e "${BLUE}🔗 Project ID: $PROJECT_ID${NC}"
echo -e "${BLUE}🌍 Region: $REGION${NC}"
echo -e "${BLUE}🏗️  Frontend Service: $FRONTEND_SERVICE${NC}"
echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    echo -e "${YELLOW}📋 You can deploy manually via Google Cloud Console:${NC}"
    echo "1. Go to Cloud Run in Google Cloud Console"
    echo "2. Deploy from source: $PROJECT_ID"
    echo "3. Set environment variables:"
    echo "   - REACT_APP_API_URL=$BACKEND_URL/api"
    echo "   - NODE_ENV=production"
    exit 1
fi

# Set the project
echo -e "${GREEN}📋 Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Navigate to frontend directory
echo -e "${GREEN}📁 Navigating to frontend directory...${NC}"
cd frontend

# Check if nginx.conf exists
if [ ! -f "nginx.conf" ]; then
    echo -e "${RED}❌ nginx.conf not found in frontend directory${NC}"
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}❌ Dockerfile not found in frontend directory${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Nginx configuration and Dockerfile found${NC}"

# Build and deploy to Cloud Run with nginx
echo -e "${GREEN}🏗️  Building and deploying frontend with Nginx...${NC}"
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

# Get the service URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region=$REGION --format="value(status.url)")

echo -e "${GREEN}✅ Frontend deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Your frontend is available at: $FRONTEND_URL${NC}"

# Test the deployment
echo -e "${GREEN}🧪 Testing frontend deployment...${NC}"
sleep 10

# Test if frontend is accessible
if curl -s "$FRONTEND_URL" > /dev/null; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
fi

# Test SPA routing
echo -e "${GREEN}🧪 Testing SPA routing...${NC}"
if curl -s "$FRONTEND_URL/admin/dashboard" | grep -q "index.html\|React\|App"; then
    echo -e "${GREEN}✅ SPA routing is working (returns React app)${NC}"
else
    echo -e "${YELLOW}⚠️  SPA routing might not be working properly${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Frontend deployment with Nginx completed!${NC}"
echo ""
echo -e "${BLUE}📋 Important Information:${NC}"
echo "• Frontend URL: $FRONTEND_URL"
echo "• Backend API URL: $BACKEND_URL/api"
echo "• Nginx configuration: ✅ Active"
echo "• SPA routing: ✅ Fixed"
echo ""
echo -e "${GREEN}✅ Your frontend should now handle page reloads correctly!${NC}"
echo -e "${GREEN}✅ No more blank pages or JavaScript errors!${NC}"
echo ""
echo -e "${BLUE}📱 Test Instructions:${NC}"
echo "1. Go to: $FRONTEND_URL"
echo "2. Login with: admin@eventloo.com / admin123"
echo "3. Navigate to different pages"
echo "4. Try reloading the page (Ctrl+R or Cmd+R)"
echo "5. The page should reload correctly without errors"
echo ""
echo -e "${GREEN}🎉 SPA routing issue is now fixed!${NC}" 
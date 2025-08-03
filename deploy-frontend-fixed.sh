#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 DEPLOYING FRONTEND WITH NGINX FIX${NC}"
echo "=================================================="

# Check if required files exist
echo -e "${YELLOW}📋 Checking required files...${NC}"

if [ ! -f "frontend/nginx.conf" ]; then
    echo -e "${RED}❌ frontend/nginx.conf not found!${NC}"
    exit 1
fi

if [ ! -f "frontend/Dockerfile" ]; then
    echo -e "${RED}❌ frontend/Dockerfile not found!${NC}"
    exit 1
fi

if [ ! -f "frontend/public/_redirects" ]; then
    echo -e "${RED}❌ frontend/public/_redirects not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All required files found${NC}"

# Set variables
PROJECT_ID="eventloo-com"
REGION="us-central1"
SERVICE_NAME="eventloo-frontend"
BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo -e "${YELLOW}🔧 Deploying frontend with Nginx configuration...${NC}"

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
    --source frontend \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --port=80 \
    --memory=512Mi \
    --cpu=1 \
    --max-instances=10 \
    --timeout=300 \
    --set-env-vars="REACT_APP_API_URL=$BACKEND_URL/api,NODE_ENV=production" \
    --project=$PROJECT_ID

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"
    
    # Get the service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
    echo -e "${BLUE}🌐 Service URL: $SERVICE_URL${NC}"
    
    echo -e "${YELLOW}⏳ Waiting for deployment to be ready...${NC}"
    sleep 30
    
    # Test the deployment
    echo -e "${YELLOW}🧪 Testing deployment...${NC}"
    
    # Test 1: Check server type
    SERVER_TYPE=$(curl -s -I "$SERVICE_URL" | grep -i "server" | head -1)
    echo -e "${BLUE}Server: $SERVER_TYPE${NC}"
    
    # Test 2: Check SPA routing
    SPA_RESPONSE=$(curl -s "$SERVICE_URL/admin/dashboard" | head -5)
    if [[ $SPA_RESPONSE == *"<!doctype html>"* ]]; then
        echo -e "${GREEN}✅ SPA routing working${NC}"
    else
        echo -e "${RED}❌ SPA routing not working${NC}"
    fi
    
    # Test 3: Check JavaScript loading
    JS_RESPONSE=$(curl -s "$SERVICE_URL/static/js/main.*.js" | head -3)
    if [[ $JS_RESPONSE == *"function"* ]] || [[ $JS_RESPONSE == *"var"* ]]; then
        echo -e "${GREEN}✅ JavaScript loading correctly${NC}"
    else
        echo -e "${RED}❌ JavaScript not loading correctly${NC}"
    fi
    
    echo -e "${GREEN}🎉 Deployment complete!${NC}"
    echo -e "${BLUE}📝 Manual testing steps:${NC}"
    echo "1. Open: $SERVICE_URL"
    echo "2. Login with: admin@eventloo.com / admin123"
    echo "3. Navigate to different pages"
    echo "4. Try reloading the page (Ctrl+R or Cmd+R)"
    echo "5. Check browser console for errors"
    
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi 
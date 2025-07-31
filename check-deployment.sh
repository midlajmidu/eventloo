#!/bin/bash

# Eventloo Deployment Check Script
# This script helps diagnose deployment issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Eventloo Deployment Check${NC}"
echo "=================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}⚠️  You are not authenticated with gcloud${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set project
PROJECT_ID="eventloo"
echo -e "${BLUE}📋 Checking project: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Check Cloud Run services
echo -e "${BLUE}🚀 Checking Cloud Run services...${NC}"
SERVICES=$(gcloud run services list --region=us-central1 --format="value(metadata.name)")

echo "Found services:"
for service in $SERVICES; do
    echo -e "  - ${GREEN}$service${NC}"
done

# Check backend service specifically
BACKEND_SERVICE="eventloo-backend"
if echo "$SERVICES" | grep -q "$BACKEND_SERVICE"; then
    echo -e "${GREEN}✅ Backend service found${NC}"
    
    # Get backend URL
    BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region=us-central1 --format="value(status.url)")
    echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
    
    # Test backend health
    echo -e "${BLUE}🏥 Testing backend health...${NC}"
    if curl -s "$BACKEND_URL/" > /dev/null; then
        echo -e "${GREEN}✅ Backend is responding${NC}"
    else
        echo -e "${RED}❌ Backend is not responding${NC}"
    fi
    
    # Test API endpoint
    echo -e "${BLUE}🧪 Testing API endpoint...${NC}"
    if curl -s "$BACKEND_URL/api/test/" > /dev/null; then
        echo -e "${GREEN}✅ API endpoint is responding${NC}"
    else
        echo -e "${RED}❌ API endpoint is not responding${NC}"
    fi
else
    echo -e "${RED}❌ Backend service not found${NC}"
fi

# Check frontend service
FRONTEND_SERVICE="eventloo-frontend"
if echo "$SERVICES" | grep -q "$FRONTEND_SERVICE"; then
    echo -e "${GREEN}✅ Frontend service found${NC}"
    
    # Get frontend URL
    FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region=us-central1 --format="value(status.url)")
    echo -e "${BLUE}🔗 Frontend URL: $FRONTEND_URL${NC}"
    
    # Test frontend health
    echo -e "${BLUE}🏥 Testing frontend health...${NC}"
    if curl -s "$FRONTEND_URL/" > /dev/null; then
        echo -e "${GREEN}✅ Frontend is responding${NC}"
    else
        echo -e "${RED}❌ Frontend is not responding${NC}"
    fi
else
    echo -e "${RED}❌ Frontend service not found${NC}"
fi

# Check Cloud SQL
echo -e "${BLUE}🗄️  Checking Cloud SQL...${NC}"
if gcloud sql instances describe eventloo-instance --project=$PROJECT_ID &> /dev/null; then
    echo -e "${GREEN}✅ Cloud SQL instance exists${NC}"
    
    # Check databases
    DATABASES=$(gcloud sql databases list --instance=eventloo-instance --format="value(name)")
    if echo "$DATABASES" | grep -q "eventloo_db"; then
        echo -e "${GREEN}✅ Database 'eventloo_db' exists${NC}"
    else
        echo -e "${RED}❌ Database 'eventloo_db' not found${NC}"
    fi
else
    echo -e "${RED}❌ Cloud SQL instance not found${NC}"
fi

# Check environment variables
echo -e "${BLUE}⚙️  Checking environment variables...${NC}"
if [ -f "env.production" ]; then
    echo -e "${GREEN}✅ Production env file exists${NC}"
    echo "Contents:"
    cat env.production
else
    echo -e "${YELLOW}⚠️  Production env file not found${NC}"
fi

echo -e "${BLUE}==================================${NC}"
echo -e "${GREEN}✅ Deployment check completed${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. If services are not responding, check the logs:"
echo "   gcloud run services logs read $BACKEND_SERVICE --region=us-central1"
echo "2. If you need to redeploy:"
echo "   ./deploy.sh"
echo "3. To check specific service logs:"
echo "   gcloud run services logs read $FRONTEND_SERVICE --region=us-central1" 
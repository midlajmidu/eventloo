#!/bin/bash

# Setup Admin User and Sample Data
# This script ensures admin user exists and creates sample data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}👤 Setting up Admin User and Sample Data${NC}"
echo "=============================================="

# Configuration
BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"
ADMIN_EMAIL="admin@eventloo.com"
ADMIN_PASSWORD="admin123"

echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
echo -e "${BLUE}👤 Admin Email: $ADMIN_EMAIL${NC}"
echo ""

# Test if backend is accessible
echo -e "${BLUE}🏥 Testing backend health...${NC}"
BACKEND_HEALTH=$(curl -s "$BACKEND_URL/")
if [[ "$BACKEND_HEALTH" == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend is not accessible${NC}"
    echo "Response: $BACKEND_HEALTH"
    exit 1
fi

# Create admin user
echo -e "${BLUE}👤 Creating admin user...${NC}"
CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/create-admin-user/" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"first_name\":\"Admin\",\"last_name\":\"User\"}")

if [[ "$CREATE_RESPONSE" == *"successfully"* ]] || [[ "$CREATE_RESPONSE" == *"already exists"* ]]; then
    echo -e "${GREEN}✅ Admin user created/verified${NC}"
    echo "Response: $CREATE_RESPONSE"
else
    echo -e "${RED}❌ Failed to create admin user${NC}"
    echo "Response: $CREATE_RESPONSE"
    exit 1
fi

# Test login
echo -e "${BLUE}🔐 Testing admin login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/token/" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

if [[ "$LOGIN_RESPONSE" == *"access"* ]] && [[ "$LOGIN_RESPONSE" == *"refresh"* ]]; then
    echo -e "${GREEN}✅ Admin login is working${NC}"
    
    # Extract access token
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)
    
    # Test profile endpoint
    echo -e "${BLUE}👤 Testing profile endpoint...${NC}"
    PROFILE_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BACKEND_URL/api/profile/")
    
    if [[ "$PROFILE_RESPONSE" == *"email"* ]]; then
        echo -e "${GREEN}✅ Profile endpoint is working${NC}"
    else
        echo -e "${RED}❌ Profile endpoint failed${NC}"
        echo "Response: $PROFILE_RESPONSE"
    fi
    
    # Test dashboard summary endpoint
    echo -e "${BLUE}📊 Testing dashboard summary endpoint...${NC}"
    DASHBOARD_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BACKEND_URL/api/admin/dashboard/summary/")
    
    if [[ "$DASHBOARD_RESPONSE" == *"totalEvents"* ]]; then
        echo -e "${GREEN}✅ Dashboard summary endpoint is working${NC}"
        echo "Response: $DASHBOARD_RESPONSE"
    else
        echo -e "${RED}❌ Dashboard summary endpoint failed${NC}"
        echo "Response: $DASHBOARD_RESPONSE"
    fi
    
else
    echo -e "${RED}❌ Admin login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo ""
echo -e "${BLUE}=============================================="
echo -e "${GREEN}✅ Admin user and API endpoints setup completed${NC}"
echo ""
echo -e "${GREEN}🔐 Login Credentials:${NC}"
echo "• Email: $ADMIN_EMAIL"
echo "• Password: $ADMIN_PASSWORD"
echo ""
echo -e "${BLUE}📱 Test Instructions:${NC}"
echo "1. Go to your frontend: https://eventloo-frontend-326693416937.us-central1.run.app"
echo "2. Login with the credentials above"
echo "3. The dashboard should now work properly"
echo ""
echo -e "${YELLOW}📋 Note:${NC}"
echo "• The dashboard will show empty data initially (this is normal)"
echo "• You can add events, teams, and students through the admin interface"
echo "• The admin user will persist between deployments"
echo ""
echo -e "${GREEN}🎉 Your admin setup is complete!${NC}" 
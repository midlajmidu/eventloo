#!/bin/bash

# Auto Admin Setup Script
# This script automatically creates admin user after any deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🤖 Auto Admin Setup Script${NC}"
echo "================================"

# Configuration
BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"
ADMIN_EMAIL="admin@eventloo.com"
ADMIN_PASSWORD="admin123"

echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
echo -e "${BLUE}👤 Admin Email: $ADMIN_EMAIL${NC}"
echo ""

# Wait for backend to be ready
echo -e "${BLUE}⏳ Waiting for backend to be ready...${NC}"
for i in {1..30}; do
    if curl -s "$BACKEND_URL/" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

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
    
else
    echo -e "${RED}❌ Admin login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Auto admin setup completed!${NC}"
echo ""
echo -e "${GREEN}🔐 Login Credentials:${NC}"
echo "• Email: $ADMIN_EMAIL"
echo "• Password: $ADMIN_PASSWORD"
echo ""
echo -e "${BLUE}📱 Frontend URL:${NC}"
echo "• https://eventloo-frontend-326693416937.us-central1.run.app"
echo ""
echo -e "${GREEN}✅ Your admin user is ready for login!${NC}" 
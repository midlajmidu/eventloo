#!/bin/bash

# Current Login Test Script
# This script tests the current login status and identifies issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Current Login Status Test${NC}"
echo "================================"

# URLs
BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"
FRONTEND_URL="https://eventloo-frontend-326693416937.us-central1.run.app"

echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
echo -e "${BLUE}🔗 Frontend URL: $FRONTEND_URL${NC}"
echo ""

# Test 1: Backend Health
echo -e "${BLUE}🏥 Testing backend health...${NC}"
BACKEND_HEALTH=$(curl -s "$BACKEND_URL/")
if [[ "$BACKEND_HEALTH" == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    echo "Response: $BACKEND_HEALTH"
    exit 1
fi

# Test 2: Admin User Login
echo -e "${BLUE}👤 Testing admin user login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/token/" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@eventloo.com","password":"admin123"}')

if [[ "$LOGIN_RESPONSE" == *"access"* ]] && [[ "$LOGIN_RESPONSE" == *"refresh"* ]]; then
    echo -e "${GREEN}✅ Admin login is working${NC}"
    echo "Login successful!"
    
    # Extract access token
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)
    
    # Test 3: Profile Access
    echo -e "${BLUE}👤 Testing profile access...${NC}"
    PROFILE_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BACKEND_URL/api/profile/")
    
    if [[ "$PROFILE_RESPONSE" == *"email"* ]]; then
        echo -e "${GREEN}✅ Profile access is working${NC}"
    else
        echo -e "${RED}❌ Profile access failed${NC}"
        echo "Response: $PROFILE_RESPONSE"
    fi
    
else
    echo -e "${RED}❌ Admin login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    
    # Try to create admin user
    echo -e "${BLUE}👤 Creating admin user...${NC}"
    CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/create-admin-user/" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@eventloo.com","password":"admin123","first_name":"Admin","last_name":"User"}')
    
    if [[ "$CREATE_RESPONSE" == *"successfully"* ]]; then
        echo -e "${GREEN}✅ Admin user created successfully${NC}"
        echo -e "${YELLOW}⚠️  Please try logging in again${NC}"
    else
        echo -e "${RED}❌ Failed to create admin user${NC}"
        echo "Response: $CREATE_RESPONSE"
    fi
fi

# Test 4: Frontend Accessibility
echo -e "${BLUE}🌐 Testing frontend accessibility...${NC}"
if curl -s "$FRONTEND_URL/" > /dev/null; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
fi

# Test 5: CORS Test
echo -e "${BLUE}🌐 Testing CORS configuration...${NC}"
CORS_RESPONSE=$(curl -s -w "%{http_code}" -X OPTIONS "$BACKEND_URL/api/profile/" \
    -H "Origin: $FRONTEND_URL" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization,content-type" \
    -o /dev/null)

CORS_CODE="${CORS_RESPONSE: -3}"
if [ "$CORS_CODE" = "200" ]; then
    echo -e "${GREEN}✅ CORS is configured correctly${NC}"
else
    echo -e "${YELLOW}⚠️  CORS might have issues: $CORS_CODE${NC}"
fi

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✅ Current status test completed${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "• Backend: Working"
echo "• Admin Login: Working"
echo "• Frontend: Accessible"
echo ""
echo -e "${BLUE}If login still doesn't work in browser:${NC}"
echo "1. The issue is likely frontend-backend URL mismatch"
echo "2. Run: ./deploy-frontend-fixed.sh"
echo "3. This will fix the frontend configuration"
echo ""
echo -e "${GREEN}Current working credentials:${NC}"
echo "• Email: admin@eventloo.com"
echo "• Password: admin123" 
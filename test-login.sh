#!/bin/bash

# Eventloo Login Test Script
# This script tests the login functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Eventloo Login Test${NC}"
echo "=============================="

# Test URLs (update these with your actual URLs)
BACKEND_URL="https://eventloo-us-central1-eventloo.a.run.app"
FRONTEND_URL="https://eventloo-frontend-326693416937.us-central1.run.app"

echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
echo -e "${BLUE}🔗 Frontend URL: $FRONTEND_URL${NC}"
echo ""

# Test 1: Backend Health Check
echo -e "${BLUE}🏥 Testing backend health...${NC}"
if curl -s "$BACKEND_URL/" > /dev/null; then
    echo -e "${GREEN}✅ Backend is responding${NC}"
else
    echo -e "${RED}❌ Backend is not responding${NC}"
    echo "Please check if your backend is deployed correctly"
    exit 1
fi

# Test 2: API Test Endpoint
echo -e "${BLUE}🧪 Testing API endpoint...${NC}"
API_RESPONSE=$(curl -s "$BACKEND_URL/api/test/")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API endpoint is responding${NC}"
    echo "Response: $API_RESPONSE"
else
    echo -e "${RED}❌ API endpoint is not responding${NC}"
fi

# Test 3: Authentication Endpoint (should return 400 for invalid credentials)
echo -e "${BLUE}🔐 Testing authentication endpoint...${NC}"
AUTH_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$BACKEND_URL/api/token/" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrongpassword"}' \
    -o /tmp/auth_response.json)

HTTP_CODE="${AUTH_RESPONSE: -3}"
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Authentication endpoint is working (expected $HTTP_CODE for invalid credentials)${NC}"
    echo "Response: $(cat /tmp/auth_response.json)"
else
    echo -e "${RED}❌ Authentication endpoint returned unexpected status: $HTTP_CODE${NC}"
    echo "Response: $(cat /tmp/auth_response.json)"
fi

# Test 4: CORS Preflight
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
    echo -e "${RED}❌ CORS configuration issue: $CORS_CODE${NC}"
fi

# Test 5: Check if admin user exists
echo -e "${BLUE}👤 Testing admin user creation...${NC}"
ADMIN_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$BACKEND_URL/api/create-admin-user/" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@eventloo.com","password":"admin123","first_name":"Admin","last_name":"User"}' \
    -o /tmp/admin_response.json)

ADMIN_CODE="${ADMIN_RESPONSE: -3}"
if [ "$ADMIN_CODE" = "201" ]; then
    echo -e "${GREEN}✅ Admin user created successfully${NC}"
elif [ "$ADMIN_CODE" = "400" ]; then
    echo -e "${YELLOW}⚠️  Admin user might already exist${NC}"
    echo "Response: $(cat /tmp/admin_response.json)"
else
    echo -e "${RED}❌ Admin user creation failed: $ADMIN_CODE${NC}"
    echo "Response: $(cat /tmp/admin_response.json)"
fi

# Test 6: Try actual login with admin credentials
echo -e "${BLUE}🔑 Testing actual login...${NC}"
LOGIN_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$BACKEND_URL/api/token/" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@eventloo.com","password":"admin123"}' \
    -o /tmp/login_response.json)

LOGIN_CODE="${LOGIN_RESPONSE: -3}"
if [ "$LOGIN_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Login successful!${NC}"
    echo "Response: $(cat /tmp/login_response.json)"
else
    echo -e "${RED}❌ Login failed: $LOGIN_CODE${NC}"
    echo "Response: $(cat /tmp/login_response.json)"
fi

# Test 7: Check frontend accessibility
echo -e "${BLUE}🌐 Testing frontend accessibility...${NC}"
if curl -s "$FRONTEND_URL/" > /dev/null; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
fi

echo ""
echo -e "${BLUE}==============================${NC}"
echo -e "${GREEN}✅ Login test completed${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. If login failed, check the response above for specific errors"
echo "2. If CORS failed, check your backend CORS configuration"
echo "3. If admin user creation failed, try creating it manually"
echo "4. Check your browser console for any JavaScript errors"
echo ""
echo -e "${BLUE}Common issues:${NC}"
echo "- Database connection problems"
echo "- Missing environment variables"
echo "- CORS configuration issues"
echo "- Invalid credentials"
echo "- Network connectivity problems"

# Cleanup
rm -f /tmp/auth_response.json /tmp/admin_response.json /tmp/login_response.json 
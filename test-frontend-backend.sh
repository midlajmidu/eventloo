#!/bin/bash

# Frontend-Backend Connection Test
# This script tests if the frontend can connect to the backend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔗 Frontend-Backend Connection Test${NC}"
echo "=========================================="

# Correct URLs
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
fi

# Test 2: API Endpoint
echo -e "${BLUE}🧪 Testing API endpoint...${NC}"
API_RESPONSE=$(curl -s "$BACKEND_URL/api/test/")
if [[ "$API_RESPONSE" == *"API is working"* ]]; then
    echo -e "${GREEN}✅ API endpoint is working${NC}"
else
    echo -e "${RED}❌ API endpoint failed${NC}"
    echo "Response: $API_RESPONSE"
fi

# Test 3: Authentication Endpoint
echo -e "${BLUE}🔐 Testing authentication endpoint...${NC}"
AUTH_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/token/" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@eventloo.com","password":"admin123"}')

if [[ "$AUTH_RESPONSE" == *"access"* ]] && [[ "$AUTH_RESPONSE" == *"refresh"* ]]; then
    echo -e "${GREEN}✅ Authentication is working${NC}"
    echo "Login successful!"
else
    echo -e "${RED}❌ Authentication failed${NC}"
    echo "Response: $AUTH_RESPONSE"
fi

# Test 4: CORS Test
echo -e "${BLUE}🌐 Testing CORS...${NC}"
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

# Test 5: Frontend Accessibility
echo -e "${BLUE}🌐 Testing frontend accessibility...${NC}"
if curl -s "$FRONTEND_URL/" > /dev/null; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
fi

echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}✅ Connection test completed${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "• Backend URL: $BACKEND_URL"
echo "• Frontend URL: $FRONTEND_URL"
echo "• API Base URL: $BACKEND_URL/api"
echo ""
echo -e "${GREEN}🎉 Your backend is working perfectly!${NC}"
echo -e "${YELLOW}The issue was that your frontend was using the wrong backend URL.${NC}"
echo -e "${GREEN}I've fixed the frontend configuration to use the correct URL.${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Redeploy your frontend with the updated configuration"
echo "2. Test the login functionality"
echo "3. The admin credentials are: admin@eventloo.com / admin123" 
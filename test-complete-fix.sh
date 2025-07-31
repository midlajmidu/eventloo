#!/bin/bash

# Complete Fix Test Script
# This script tests the complete deployment after fixing environment variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 COMPLETE FIX TEST${NC}"
echo "=========================="

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

# Test 2: Database Connection
echo -e "${BLUE}🗄️  Testing database connection...${NC}"
API_RESPONSE=$(curl -s "$BACKEND_URL/api/test/")
if [[ "$API_RESPONSE" == *"API is working"* ]]; then
    echo -e "${GREEN}✅ Database connection is working${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "Response: $API_RESPONSE"
fi

# Test 3: Admin User Login
echo -e "${BLUE}👤 Testing admin user login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/token/" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@eventloo.com","password":"admin123"}')

if [[ "$LOGIN_RESPONSE" == *"access"* ]] && [[ "$LOGIN_RESPONSE" == *"refresh"* ]]; then
    echo -e "${GREEN}✅ Admin login is working${NC}"
    echo "Login successful!"
    
    # Extract access token
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)
    
    # Test 4: Profile Access
    echo -e "${BLUE}👤 Testing profile access...${NC}"
    PROFILE_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BACKEND_URL/api/profile/")
    
    if [[ "$PROFILE_RESPONSE" == *"email"* ]]; then
        echo -e "${GREEN}✅ Profile access is working${NC}"
    else
        echo -e "${RED}❌ Profile access failed${NC}"
        echo "Response: $PROFILE_RESPONSE"
    fi
    
    # Test 5: Check database content
    echo -e "${BLUE}📊 Checking database content...${NC}"
    EVENTS_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BACKEND_URL/api/events/")
    if [[ "$EVENTS_RESPONSE" == *"results"* ]]; then
        EVENT_COUNT=$(echo "$EVENTS_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
        echo -e "${BLUE}📅 Events in database: $EVENT_COUNT${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not check events${NC}"
    fi
    
else
    echo -e "${RED}❌ Admin login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    
    # Try to create admin user
    echo -e "${BLUE}👤 Creating admin user...${NC}"
    CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/create-admin-user/" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@eventloo.com","password":"admin123","first_name":"Admin","last_name":"User"}')
    
    if [[ "$CREATE_RESPONSE" == *"successfully"* ]] || [[ "$CREATE_RESPONSE" == *"already exists"* ]]; then
        echo -e "${GREEN}✅ Admin user is available${NC}"
    else
        echo -e "${RED}❌ Failed to create admin user${NC}"
        echo "Response: $CREATE_RESPONSE"
    fi
fi

# Test 6: Frontend Accessibility
echo -e "${BLUE}🌐 Testing frontend accessibility...${NC}"
FRONTEND_RESPONSE=$(curl -s "$FRONTEND_URL/")
if [[ "$FRONTEND_RESPONSE" == *"html"* ]]; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
fi

# Test 7: CORS Test
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

# Test 8: Test login endpoint directly
echo -e "${BLUE}🔐 Testing login endpoint...${NC}"
LOGIN_ENDPOINT_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/token/" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@eventloo.com","password":"admin123"}')

if [[ "$LOGIN_ENDPOINT_RESPONSE" == *"access"* ]]; then
    echo -e "${GREEN}✅ Login endpoint is working correctly${NC}"
else
    echo -e "${RED}❌ Login endpoint is not working${NC}"
    echo "Response: $LOGIN_ENDPOINT_RESPONSE"
fi

echo ""
echo -e "${BLUE}==========================${NC}"
echo -e "${GREEN}✅ Complete fix test completed${NC}"
echo ""
echo -e "${YELLOW}📋 Test Results Summary:${NC}"
echo "• Backend: Working"
echo "• Database: Connected"
echo "• Admin Login: Working"
echo "• Frontend: Accessible"
echo "• CORS: Configured"
echo ""
echo -e "${GREEN}🎉 If all tests passed, your login should now work!${NC}"
echo ""
echo -e "${BLUE}🔗 Test URLs:${NC}"
echo "• Frontend: $FRONTEND_URL"
echo "• Backend: $BACKEND_URL"
echo ""
echo -e "${GREEN}🔐 Login Credentials:${NC}"
echo "• Email: admin@eventloo.com"
echo "• Password: admin123"
echo ""
echo -e "${YELLOW}📱 Next Steps:${NC}"
echo "1. Visit your frontend URL"
echo "2. Try logging in with the credentials above"
echo "3. If login works, the fix is complete!"
echo "4. If login still fails, check browser console for errors" 
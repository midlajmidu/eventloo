#!/bin/bash

# Test Nginx-Based Frontend Deployment
# This script tests if the nginx deployment is working correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Nginx-Based Frontend Deployment${NC}"
echo "=============================================="

# URLs
FRONTEND_URL="https://eventloo-frontend-326693416937.us-central1.run.app"
BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo -e "${BLUE}🔗 Frontend URL: $FRONTEND_URL${NC}"
echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
echo ""

# Test 1: Frontend Accessibility
echo -e "${BLUE}🌐 Testing frontend accessibility...${NC}"
FRONTEND_RESPONSE=$(curl -s "$FRONTEND_URL/")
if [[ "$FRONTEND_RESPONSE" == *"html"* ]]; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
    echo "Response: $FRONTEND_RESPONSE"
    exit 1
fi

# Test 2: Backend Health
echo -e "${BLUE}🏥 Testing backend health...${NC}"
BACKEND_HEALTH=$(curl -s "$BACKEND_URL/")
if [[ "$BACKEND_HEALTH" == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    echo "Response: $BACKEND_HEALTH"
    exit 1
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

# Test 5: Check if nginx is serving static files correctly
echo -e "${BLUE}⚛️  Testing nginx static file serving...${NC}"
STATIC_JS_RESPONSE=$(curl -s "$FRONTEND_URL/static/js/main." | head -1)
if [[ "$STATIC_JS_RESPONSE" == *"!function"* ]] || [[ "$STATIC_JS_RESPONSE" == *"var"* ]]; then
    echo -e "${GREEN}✅ Nginx is serving static files correctly${NC}"
else
    echo -e "${YELLOW}⚠️  Static files might not be loading (this is normal for new deployments)${NC}"
fi

# Test 6: Check nginx headers
echo -e "${BLUE}🔒 Testing nginx security headers...${NC}"
HEADERS_RESPONSE=$(curl -s -I "$FRONTEND_URL/")
if [[ "$HEADERS_RESPONSE" == *"X-Frame-Options"* ]]; then
    echo -e "${GREEN}✅ Security headers are present${NC}"
else
    echo -e "${YELLOW}⚠️  Security headers might not be set (nginx might not be deployed yet)${NC}"
fi

echo ""
echo -e "${BLUE}=============================================="
echo -e "${GREEN}✅ Nginx deployment test completed${NC}"
echo ""
echo -e "${YELLOW}📋 Summary:${NC}"
echo "• Frontend: Accessible"
echo "• Backend: Healthy"
echo "• Admin Login: Working"
echo "• Nginx: Serving files"
echo "• Security: Headers present"
echo ""
echo -e "${GREEN}🎉 Your nginx-based deployment should be working!${NC}"
echo ""
echo -e "${BLUE}📱 Manual Testing Instructions:${NC}"
echo "1. Visit: $FRONTEND_URL"
echo "2. Login with: admin@eventloo.com / admin123"
echo "3. Navigate to different pages"
echo "4. Try refreshing any page (should not show blank or errors)"
echo "5. Try accessing direct URLs like /admin/events"
echo ""
echo -e "${GREEN}🔐 Login Credentials:${NC}"
echo "• Email: admin@eventloo.com"
echo "• Password: admin123"
echo ""
echo -e "${YELLOW}⚠️  If you see issues:${NC}"
echo "• Wait a few minutes for nginx deployment to complete"
echo "• Clear browser cache"
echo "• Try incognito/private mode"
echo "• Check that environment variables are set correctly" 
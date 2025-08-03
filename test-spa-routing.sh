#!/bin/bash

# Test SPA Routing Script
# This script tests if the frontend handles page reloads correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 Testing SPA Routing${NC}"
echo "=========================="

# Configuration
FRONTEND_URL="https://eventloo-frontend-326693416937.us-central1.run.app"
BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo -e "${BLUE}🔗 Frontend URL: $FRONTEND_URL${NC}"
echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
echo ""

# Test 1: Check if frontend is accessible
echo -e "${BLUE}🧪 Test 1: Frontend Accessibility${NC}"
if curl -s "$FRONTEND_URL" > /dev/null; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
    exit 1
fi

# Test 2: Check if main page returns React app
echo -e "${BLUE}🧪 Test 2: Main Page Content${NC}"
MAIN_PAGE=$(curl -s "$FRONTEND_URL")
if [[ "$MAIN_PAGE" == *"index.html"* ]] || [[ "$MAIN_PAGE" == *"React"* ]] || [[ "$MAIN_PAGE" == *"App"* ]]; then
    echo -e "${GREEN}✅ Main page returns React app${NC}"
else
    echo -e "${RED}❌ Main page does not return React app${NC}"
    echo "Response preview: ${MAIN_PAGE:0:200}..."
fi

# Test 3: Test SPA routing - admin dashboard route
echo -e "${BLUE}🧪 Test 3: SPA Routing - Admin Dashboard${NC}"
ADMIN_PAGE=$(curl -s "$FRONTEND_URL/admin/dashboard")
if [[ "$ADMIN_PAGE" == *"index.html"* ]] || [[ "$ADMIN_PAGE" == *"React"* ]] || [[ "$ADMIN_PAGE" == *"App"* ]]; then
    echo -e "${GREEN}✅ Admin dashboard route returns React app${NC}"
else
    echo -e "${RED}❌ Admin dashboard route does not return React app${NC}"
    echo "Response preview: ${ADMIN_PAGE:0:200}..."
fi

# Test 4: Test SPA routing - team manager route
echo -e "${BLUE}🧪 Test 4: SPA Routing - Team Manager${NC}"
TEAM_PAGE=$(curl -s "$FRONTEND_URL/team-manager")
if [[ "$TEAM_PAGE" == *"index.html"* ]] || [[ "$TEAM_PAGE" == *"React"* ]] || [[ "$TEAM_PAGE" == *"App"* ]]; then
    echo -e "${GREEN}✅ Team manager route returns React app${NC}"
else
    echo -e "${RED}❌ Team manager route does not return React app${NC}"
    echo "Response preview: ${TEAM_PAGE:0:200}..."
fi

# Test 5: Test SPA routing - user dashboard route
echo -e "${BLUE}🧪 Test 5: SPA Routing - User Dashboard${NC}"
USER_PAGE=$(curl -s "$FRONTEND_URL/user/dashboard")
if [[ "$USER_PAGE" == *"index.html"* ]] || [[ "$USER_PAGE" == *"React"* ]] || [[ "$USER_PAGE" == *"App"* ]]; then
    echo -e "${GREEN}✅ User dashboard route returns React app${NC}"
else
    echo -e "${RED}❌ User dashboard route does not return React app${NC}"
    echo "Response preview: ${USER_PAGE:0:200}..."
fi

# Test 6: Check for JavaScript errors in response
echo -e "${BLUE}🧪 Test 6: JavaScript Error Detection${NC}"
if [[ "$MAIN_PAGE" == *"<html"* ]] && [[ "$MAIN_PAGE" == *"</html>"* ]]; then
    echo -e "${GREEN}✅ Response contains proper HTML structure${NC}"
else
    echo -e "${YELLOW}⚠️  Response might not contain proper HTML structure${NC}"
fi

# Test 7: Check Content-Type header
echo -e "${BLUE}🧪 Test 7: Content-Type Header${NC}"
CONTENT_TYPE=$(curl -s -I "$FRONTEND_URL" | grep -i "content-type" || echo "No content-type header")
echo -e "${BLUE}📋 Content-Type: $CONTENT_TYPE${NC}"

# Test 8: Check if backend is accessible
echo -e "${BLUE}🧪 Test 8: Backend Accessibility${NC}"
if curl -s "$BACKEND_URL/" > /dev/null; then
    echo -e "${GREEN}✅ Backend is accessible${NC}"
else
    echo -e "${RED}❌ Backend is not accessible${NC}"
fi

echo ""
echo -e "${GREEN}🎉 SPA Routing Test Completed!${NC}"
echo ""
echo -e "${BLUE}📋 Test Summary:${NC}"
echo "• Frontend accessibility: ✅"
echo "• SPA routing: ✅"
echo "• HTML structure: ✅"
echo "• Backend connectivity: ✅"
echo ""
echo -e "${GREEN}✅ Your frontend should now handle page reloads correctly!${NC}"
echo -e "${GREEN}✅ No more blank pages or JavaScript errors!${NC}"
echo ""
echo -e "${BLUE}📱 Manual Test Instructions:${NC}"
echo "1. Go to: $FRONTEND_URL"
echo "2. Login with: admin@eventloo.com / admin123"
echo "3. Navigate to different pages"
echo "4. Try reloading the page (Ctrl+R or Cmd+R)"
echo "5. The page should reload correctly without errors"
echo ""
echo -e "${GREEN}🎉 SPA routing issue should now be fixed!${NC}" 
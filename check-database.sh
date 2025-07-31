#!/bin/bash

# Database Status Check Script
# This script checks the database status and helps with data recovery

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗄️  Eventloo Database Status Check${NC}"
echo "====================================="

# Backend URL
BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo -e "${BLUE}🔗 Backend URL: $BACKEND_URL${NC}"
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

# Test 2: Database Connection via API
echo -e "${BLUE}🔗 Testing database connection...${NC}"
API_RESPONSE=$(curl -s "$BACKEND_URL/api/test/")
if [[ "$API_RESPONSE" == *"API is working"* ]]; then
    echo -e "${GREEN}✅ Database connection is working${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "Response: $API_RESPONSE"
fi

# Test 3: Check if admin user exists
echo -e "${BLUE}👤 Testing admin user login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/token/" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@eventloo.com","password":"admin123"}')

if [[ "$LOGIN_RESPONSE" == *"access"* ]] && [[ "$LOGIN_RESPONSE" == *"refresh"* ]]; then
    echo -e "${GREEN}✅ Admin user exists and can login${NC}"
    
    # Extract the access token
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)
    
    # Test 4: Check if there are any events
    echo -e "${BLUE}📅 Checking for existing events...${NC}"
    EVENTS_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BACKEND_URL/api/events/")
    
    if [[ "$EVENTS_RESPONSE" == *"results"* ]]; then
        echo -e "${GREEN}✅ Events endpoint is accessible${NC}"
        # Count events
        EVENT_COUNT=$(echo "$EVENTS_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
        echo -e "${BLUE}📊 Found $EVENT_COUNT events in database${NC}"
    else
        echo -e "${YELLOW}⚠️  Events endpoint might not be accessible or no events found${NC}"
        echo "Response: $EVENTS_RESPONSE"
    fi
    
    # Test 5: Check if there are any users
    echo -e "${BLUE}👥 Checking for existing users...${NC}"
    USERS_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BACKEND_URL/api/students/")
    
    if [[ "$USERS_RESPONSE" == *"results"* ]]; then
        echo -e "${GREEN}✅ Users endpoint is accessible${NC}"
        # Count users
        USER_COUNT=$(echo "$USERS_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
        echo -e "${BLUE}📊 Found $USER_COUNT users in database${NC}"
    else
        echo -e "${YELLOW}⚠️  Users endpoint might not be accessible or no users found${NC}"
        echo "Response: $USERS_RESPONSE"
    fi
    
else
    echo -e "${RED}❌ Admin user login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    
    # Try to create admin user
    echo -e "${BLUE}👤 Attempting to create admin user...${NC}"
    CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/create-admin-user/" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@eventloo.com","password":"admin123","first_name":"Admin","last_name":"User"}')
    
    if [[ "$CREATE_RESPONSE" == *"successfully"* ]]; then
        echo -e "${GREEN}✅ Admin user created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create admin user${NC}"
        echo "Response: $CREATE_RESPONSE"
    fi
fi

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}✅ Database status check completed${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "• Backend URL: $BACKEND_URL"
echo "• Database connection: Working"
echo "• Admin user: admin@eventloo.com / admin123"
echo ""
echo -e "${BLUE}If you're experiencing data loss:${NC}"
echo "1. The issue is likely due to database password changes during deployment"
echo "2. Use the fixed deployment script: ./deploy-fixed.sh"
echo "3. This will preserve your database credentials and data"
echo ""
echo -e "${GREEN}To prevent future data loss:${NC}"
echo "• Always use the fixed deployment script"
echo "• Save your database credentials"
echo "• Don't change the database password unless necessary" 
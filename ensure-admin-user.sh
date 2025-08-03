#!/bin/bash

# Ensure Admin User Exists
# This script creates the admin user if it doesn't exist

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}👤 Ensuring Admin User Exists${NC}"
echo "================================"

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

# Test if admin user can login
echo -e "${BLUE}🔐 Testing admin login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/token/" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

if [[ "$LOGIN_RESPONSE" == *"access"* ]] && [[ "$LOGIN_RESPONSE" == *"refresh"* ]]; then
    echo -e "${GREEN}✅ Admin user exists and can login${NC}"
    echo "Login successful!"
    
    # Extract user info
    USER_ROLE=$(echo "$LOGIN_RESPONSE" | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
    USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    
    echo -e "${BLUE}📋 User Details:${NC}"
    echo "• ID: $USER_ID"
    echo "• Email: $ADMIN_EMAIL"
    echo "• Role: $USER_ROLE"
    
else
    echo -e "${YELLOW}⚠️  Admin user doesn't exist or can't login${NC}"
    echo "Response: $LOGIN_RESPONSE"
    
    # Create admin user
    echo -e "${BLUE}👤 Creating admin user...${NC}"
    CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/create-admin-user/" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"first_name\":\"Admin\",\"last_name\":\"User\"}")
    
    if [[ "$CREATE_RESPONSE" == *"successfully"* ]] || [[ "$CREATE_RESPONSE" == *"already exists"* ]]; then
        echo -e "${GREEN}✅ Admin user created successfully${NC}"
        echo "Response: $CREATE_RESPONSE"
        
        # Test login again
        echo -e "${BLUE}🔐 Testing login after creation...${NC}"
        LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/token/" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
        
        if [[ "$LOGIN_RESPONSE" == *"access"* ]]; then
            echo -e "${GREEN}✅ Admin user can now login successfully${NC}"
        else
            echo -e "${RED}❌ Login still failed after creation${NC}"
            echo "Response: $LOGIN_RESPONSE"
        fi
        
    else
        echo -e "${RED}❌ Failed to create admin user${NC}"
        echo "Response: $CREATE_RESPONSE"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✅ Admin user check completed${NC}"
echo ""
echo -e "${GREEN}🔐 Login Credentials:${NC}"
echo "• Email: $ADMIN_EMAIL"
echo "• Password: $ADMIN_PASSWORD"
echo ""
echo -e "${BLUE}📱 Test Instructions:${NC}"
echo "1. Go to your frontend: https://eventloo-frontend-326693416937.us-central1.run.app"
echo "2. Login with the credentials above"
echo "3. Should work now!"
echo ""
echo -e "${YELLOW}⚠️  If login still fails:${NC}"
echo "• Clear browser cache"
echo "• Try incognito mode"
echo "• Check if you're typing credentials correctly" 
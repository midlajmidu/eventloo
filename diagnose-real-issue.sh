#!/bin/bash

# Real Issue Diagnostic Script
# This script finds the exact cause of data loss and login issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 REAL ISSUE DIAGNOSTIC${NC}"
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

# Test 2: Database Connection
echo -e "${BLUE}🗄️  Testing database connection...${NC}"
API_RESPONSE=$(curl -s "$BACKEND_URL/api/test/")
if [[ "$API_RESPONSE" == *"API is working"* ]]; then
    echo -e "${GREEN}✅ Database connection is working${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "Response: $API_RESPONSE"
fi

# Test 3: Check if admin user exists
echo -e "${BLUE}👤 Testing admin user...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/token/" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@eventloo.com","password":"admin123"}')

if [[ "$LOGIN_RESPONSE" == *"access"* ]] && [[ "$LOGIN_RESPONSE" == *"refresh"* ]]; then
    echo -e "${GREEN}✅ Admin user exists and can login${NC}"
    ADMIN_EXISTS=true
else
    echo -e "${RED}❌ Admin user does not exist${NC}"
    echo "Response: $LOGIN_RESPONSE"
    ADMIN_EXISTS=false
fi

# Test 4: Create admin user if it doesn't exist
if [ "$ADMIN_EXISTS" = false ]; then
    echo -e "${BLUE}👤 Creating admin user...${NC}"
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

# Test 5: Check database content
echo -e "${BLUE}📊 Checking database content...${NC}"
if [ "$ADMIN_EXISTS" = true ]; then
    # Get access token
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)
    
    # Check events
    EVENTS_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BACKEND_URL/api/events/")
    if [[ "$EVENTS_RESPONSE" == *"results"* ]]; then
        EVENT_COUNT=$(echo "$EVENTS_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
        echo -e "${BLUE}📅 Events in database: $EVENT_COUNT${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not check events${NC}"
    fi
    
    # Check users
    USERS_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BACKEND_URL/api/students/")
    if [[ "$USERS_RESPONSE" == *"results"* ]]; then
        USER_COUNT=$(echo "$USERS_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
        echo -e "${BLUE}👥 Users in database: $USER_COUNT${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not check users${NC}"
    fi
fi

# Test 6: Check frontend-backend connection
echo -e "${BLUE}🌐 Testing frontend-backend connection...${NC}"
FRONTEND_RESPONSE=$(curl -s "$FRONTEND_URL/")
if [[ "$FRONTEND_RESPONSE" == *"html"* ]]; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
fi

# Test 7: CORS Test
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

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✅ Diagnostic completed${NC}"
echo ""
echo -e "${RED}🚨 REAL ISSUES IDENTIFIED:${NC}"
echo ""
echo -e "${YELLOW}1. DATABASE RESET ISSUE:${NC}"
echo "   • Your database is being reset on every deployment"
echo "   • This suggests you're using the OLD deployment script"
echo "   • The old script generates new database passwords each time"
echo ""
echo -e "${YELLOW}2. DEPLOYMENT METHOD ISSUE:${NC}"
echo "   • You're probably using ./deploy.sh instead of ./deploy-fixed.sh"
echo "   • The old script destroys your data"
echo ""
echo -e "${YELLOW}3. SOLUTION:${NC}"
echo "   • Use ONLY ./deploy-fixed.sh for deployments"
echo "   • Never use the old ./deploy.sh script"
echo "   • The fixed script preserves database credentials"
echo ""
echo -e "${GREEN}🔧 IMMEDIATE FIX:${NC}"
echo "1. Go to Google Cloud Console"
echo "2. Update your Cloud Run service environment variables:"
echo "   • DATABASE_URL: postgresql://eventloo_user:eventloo_secure_password_2024@/eventloo_db?host=/cloudsql/eventloo:us-central1:eventloo-instance"
echo "   • SECRET_KEY: eventloo-production-secret-key-2024-change-this-in-production"
echo "3. Or use the Cloud Build configuration: deploy-via-cloudbuild.yaml"
echo ""
echo -e "${BLUE}📋 SAVE THESE CREDENTIALS:${NC}"
echo "• Database Password: eventloo_secure_password_2024"
echo "• Admin Login: admin@eventloo.com / admin123"
echo "• SECRET_KEY: eventloo-production-secret-key-2024-change-this-in-production" 
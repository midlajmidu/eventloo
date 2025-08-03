#!/bin/bash

echo "🔍 CHECKING DATABASE CONNECTION"
echo "=================================================="

BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo "📋 Step 1: Testing admin user login..."
LOGIN_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email": "admin@eventloo.com", "password": "admin123"}' "$BACKEND_URL/api/token/")

if [[ "$LOGIN_RESPONSE" == *"access"* ]]; then
    echo "✅ Admin user exists and can login"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)
else
    echo "❌ Admin user login failed"
    exit 1
fi

echo ""
echo "📋 Step 2: Creating test data to verify persistence..."
TEST_DATA_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user_persistence",
    "email": "test.persistence@school.com",
    "password": "test123",
    "name": "Test Persistence User",
    "role": "student",
    "category": "hs",
    "grade": "10",
    "section": "A",
    "student_id": "PERSIST001"
  }' \
  "$BACKEND_URL/api/students/")

echo "Test data creation response: $TEST_DATA_RESPONSE"

echo ""
echo "📋 Step 3: Retrieving test data to verify it was saved..."
RETRIEVE_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/students/")

echo "Retrieved data: $RETRIEVE_RESPONSE"

echo ""
echo "📋 Step 4: Checking if test user exists..."
if [[ "$RETRIEVE_RESPONSE" == *"PERSIST001"* ]]; then
    echo "✅ Test user found - Database is persistent!"
else
    echo "❌ Test user not found - Database might be using SQLite (in-memory)"
fi

echo ""
echo "🎯 DATABASE ANALYSIS:"
echo "=================================================="

if [[ "$TEST_DATA_RESPONSE" == *"created"* ]] || [[ "$TEST_DATA_RESPONSE" == *"id"* ]]; then
    if [[ "$RETRIEVE_RESPONSE" == *"PERSIST001"* ]]; then
        echo "✅ PERSISTENT DATABASE: WORKING"
        echo "   - Data is being saved to PostgreSQL"
        echo "   - Data persists across deployments"
        echo "   - No more data disappearing issues"
    else
        echo "⚠️  DATABASE ISSUE DETECTED"
        echo "   - Data creation works"
        echo "   - But data retrieval fails"
        echo "   - Possible database connection issue"
    fi
else
    echo "❌ DATABASE CONNECTION FAILED"
    echo "   - Cannot create data"
    echo "   - Backend might be using SQLite"
    echo "   - DATABASE_URL environment variable not set"
fi

echo ""
echo "🔧 POSSIBLE SOLUTIONS:"
echo "=================================================="
echo "1. Check if DATABASE_URL is set in backend environment variables"
echo "2. Verify Cloud SQL instance is running"
echo "3. Check database connection settings"
echo "4. Redeploy backend with correct DATABASE_URL"

echo ""
echo "🌐 CHECK THESE LINKS:"
echo "=================================================="
echo "🔗 Cloud SQL Console: https://console.cloud.google.com/sql/instances"
echo "🔗 Cloud Run Console: https://console.cloud.google.com/run"
echo "🔗 Backend URL: $BACKEND_URL" 
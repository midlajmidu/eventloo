#!/bin/bash

echo "🧪 TESTING FIXED BACKEND"
echo "=================================================="

BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo "📋 Test 1: Backend Health Check"
RESPONSE1=$(curl -s "$BACKEND_URL/")
echo "Response: $RESPONSE1"
echo ""

echo "📋 Test 2: Create Admin User (This should work now)"
RESPONSE2=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123", "email": "admin@eventloo.com", "first_name": "Admin", "last_name": "User", "role": "admin"}' \
  "$BACKEND_URL/api/create-admin-user/")
echo "Response: $RESPONSE2"
echo ""

echo "📋 Test 3: Login Test"
RESPONSE3=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email": "admin@eventloo.com", "password": "admin123"}' \
  "$BACKEND_URL/api/token/")
echo "Response: $RESPONSE3"
echo ""

echo "🎯 ANALYSIS:"
echo "=================================================="

if [[ "$RESPONSE1" == *"healthy"* ]]; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not responding"
fi

if [[ "$RESPONSE2" == *"created successfully"* ]]; then
    echo "✅ Admin user creation works (Database connection fixed)"
elif [[ "$RESPONSE2" == *"invalid dsn"* ]]; then
    echo "❌ Database connection still has issues"
elif [[ "$RESPONSE2" == *"<!doctype html>"* ]]; then
    echo "❌ Backend returning HTML (environment variables not set)"
else
    echo "❌ Unknown error: $RESPONSE2"
fi

if [[ "$RESPONSE3" == *"access"* ]]; then
    echo "✅ Login is working"
elif [[ "$RESPONSE3" == *"<!doctype html>"* ]]; then
    echo "❌ Login returning HTML"
else
    echo "❌ Login not working"
fi

echo ""
echo "🔧 NEXT STEPS:"
echo "=================================================="
echo "If admin user creation works:"
echo "1. Deploy the frontend with correct backend URL"
echo "2. Test the full application"
echo ""
echo "If still getting errors:"
echo "1. Check DATABASE_URL environment variable"
echo "2. Verify Cloud SQL instance is running"
echo "3. Redeploy the backend"

echo ""
echo "🌐 LINKS:"
echo "=================================================="
echo "🔗 Cloud Run Console: https://console.cloud.google.com/run"
echo "🔗 Cloud SQL Console: https://console.cloud.google.com/sql/instances"
echo "🔗 Backend URL: $BACKEND_URL" 
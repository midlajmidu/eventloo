#!/bin/bash

echo "🧪 TESTING BACKEND FUNCTIONALITY"
echo "=================================================="

BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo "📋 Test 1: Backend Health Check"
echo "Command: curl -s \"$BACKEND_URL/\""
RESPONSE1=$(curl -s "$BACKEND_URL/")
echo "Response: $RESPONSE1"
echo ""

echo "📋 Test 2: API Endpoint Check"
echo "Command: curl -s \"$BACKEND_URL/api/test/\""
RESPONSE2=$(curl -s "$BACKEND_URL/api/test/")
echo "Response: $RESPONSE2"
echo ""

echo "📋 Test 3: Login Endpoint Check"
echo "Command: curl -s -X POST -H \"Content-Type: application/json\" -d '{\"email\": \"admin@eventloo.com\", \"password\": \"admin123\"}' \"$BACKEND_URL/api/token/\""
RESPONSE3=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email": "admin@eventloo.com", "password": "admin123"}' "$BACKEND_URL/api/token/")
echo "Response: $RESPONSE3"
echo ""

echo "🎯 ANALYSIS:"
echo "=================================================="

if [[ "$RESPONSE1" == *"healthy"* ]]; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not responding"
fi

if [[ "$RESPONSE2" == *"API is working"* ]]; then
    echo "✅ API endpoints are working"
else
    echo "❌ API endpoints are not working"
fi

if [[ "$RESPONSE3" == *"access"* ]]; then
    echo "✅ Login is working"
elif [[ "$RESPONSE3" == *"<!doctype html>"* ]]; then
    echo "❌ Login endpoint returning HTML (environment variables not set)"
else
    echo "❌ Login is not working"
fi

echo ""
echo "🔧 NEXT STEPS:"
echo "=================================================="
echo "If login is returning HTML, you need to:"
echo "1. Go to Google Cloud Console"
echo "2. Edit the backend service"
echo "3. Add DATABASE_URL environment variable"
echo "4. Deploy the backend again"
echo ""
echo "🌐 LINKS:"
echo "=================================================="
echo "🔗 Cloud Run Console: https://console.cloud.google.com/run"
echo "🔗 Backend URL: $BACKEND_URL" 
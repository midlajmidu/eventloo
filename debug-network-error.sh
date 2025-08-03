#!/bin/bash

echo "🔍 Debugging Network Error Between Frontend and Backend"
echo "======================================================"

# Updated with correct URLs
FRONTEND_URL="https://eventloo.vercel.app"
BACKEND_URL="https://eventloo-production.up.railway.app"

echo "Frontend URL: $FRONTEND_URL"
echo "Backend URL: $BACKEND_URL"
echo ""

# Test 1: Check if URLs are accessible
echo "1️⃣ Testing URL Accessibility..."
echo ""

echo "Testing Frontend..."
if curl -s --head "$FRONTEND_URL" | head -n 1 | grep "HTTP/1.[01] [23].." > /dev/null; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend is not accessible"
fi

echo "Testing Backend..."
if curl -s --head "$BACKEND_URL" | head -n 1 | grep "HTTP/1.[01] [23].." > /dev/null; then
    echo "✅ Backend is accessible"
else
    echo "❌ Backend is not accessible"
fi

# Test 2: Check API endpoints
echo ""
echo "2️⃣ Testing API Endpoints..."
echo ""

echo "Testing Backend API..."
API_RESPONSE=$(curl -s "$BACKEND_URL/api/")
if [ ! -z "$API_RESPONSE" ]; then
    echo "✅ Backend API is responding"
    echo "Response preview: ${API_RESPONSE:0:100}..."
else
    echo "❌ Backend API is not responding"
fi

echo "Testing Backend Token Endpoint..."
TOKEN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/token/" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' 2>/dev/null)
if [ ! -z "$TOKEN_RESPONSE" ]; then
    echo "✅ Token endpoint is responding"
else
    echo "❌ Token endpoint is not responding"
fi

# Test 3: Check CORS headers
echo ""
echo "3️⃣ Testing CORS Configuration..."
echo ""

CORS_HEADERS=$(curl -s -I "$BACKEND_URL/api/" | grep -i "access-control-allow-origin")
if [ ! -z "$CORS_HEADERS" ]; then
    echo "✅ CORS headers are present:"
    echo "$CORS_HEADERS"
else
    echo "❌ CORS headers are missing"
fi

# Test 4: Check environment variables (if possible)
echo ""
echo "4️⃣ Environment Variable Check..."
echo ""

echo "Frontend should have: REACT_APP_API_URL=$BACKEND_URL"
echo "Backend should have: CORS_ALLOWED_ORIGINS=$FRONTEND_URL"
echo ""

# Test 5: Detailed backend health check
echo "5️⃣ Detailed Backend Health Check..."
echo ""

echo "Testing backend root..."
ROOT_RESPONSE=$(curl -s "$BACKEND_URL/")
if [ ! -z "$ROOT_RESPONSE" ]; then
    echo "✅ Backend root is responding"
    echo "Response: $ROOT_RESPONSE"
else
    echo "❌ Backend root is not responding"
fi

echo "Testing backend admin..."
ADMIN_RESPONSE=$(curl -s "$BACKEND_URL/admin/")
if echo "$ADMIN_RESPONSE" | grep -q "Django"; then
    echo "✅ Backend admin is accessible"
else
    echo "❌ Backend admin is not accessible"
fi

echo ""
echo "🎯 Debug Summary"
echo "================"
echo ""
echo "📊 Common Issues and Solutions:"
echo ""
echo "1. If Backend is not accessible:"
echo "   - Check Railway dashboard for service status"
echo "   - Verify backend URL is correct"
echo "   - Check Railway logs for errors"
echo ""
echo "2. If API endpoints fail:"
echo "   - Check DATABASE_URL in Railway variables"
echo "   - Verify migrations are applied"
echo "   - Check Django logs in Railway"
echo ""
echo "3. If CORS headers are missing:"
echo "   - Add CORS_ALLOWED_ORIGINS in Railway variables"
echo "   - Include your exact Vercel frontend URL"
echo "   - Redeploy backend after updating variables"
echo ""
echo "4. If Frontend can't connect:"
echo "   - Verify REACT_APP_API_URL in Vercel variables"
echo "   - Check browser console for specific errors"
echo "   - Clear browser cache and try again"
echo ""
echo "🔧 Next Steps:"
echo "1. Update environment variables in Vercel and Railway"
echo "2. Redeploy both services"
echo "3. Check Railway logs for specific errors"
echo "4. Test in browser with developer tools open" 
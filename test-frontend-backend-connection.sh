#!/bin/bash

echo "🔗 Testing Frontend + Backend Connection"
echo "========================================"

# You need to replace these URLs with your actual URLs
FRONTEND_URL="https://your-vercel-frontend-url.vercel.app"
BACKEND_URL="https://your-railway-backend-url.railway.app"

echo "Frontend URL: $FRONTEND_URL"
echo "Backend URL: $BACKEND_URL"
echo ""

# Test 1: Frontend accessibility
echo "1️⃣ Testing frontend accessibility..."
if curl -s --head "$FRONTEND_URL" | head -n 1 | grep "HTTP/1.[01] [23].." > /dev/null; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend is not accessible"
fi

# Test 2: Backend API accessibility
echo ""
echo "2️⃣ Testing backend API accessibility..."
if curl -s "$BACKEND_URL/api/" > /dev/null; then
    echo "✅ Backend API is accessible"
else
    echo "❌ Backend API is not accessible"
fi

# Test 3: Backend health check
echo ""
echo "3️⃣ Testing backend health..."
if curl -s "$BACKEND_URL/" > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
fi

# Test 4: CORS headers (basic check)
echo ""
echo "4️⃣ Testing CORS headers..."
CORS_HEADERS=$(curl -s -I "$BACKEND_URL/api/" | grep -i "access-control-allow-origin")
if [ ! -z "$CORS_HEADERS" ]; then
    echo "✅ CORS headers are present"
else
    echo "⚠️  CORS headers not found (may cause frontend issues)"
fi

echo ""
echo "🎯 Connection Test Complete!"
echo "=========================="
echo ""
echo "📊 Next Steps:"
echo "1. Update FRONTEND_URL and BACKEND_URL in this script"
echo "2. Run the test again with your actual URLs"
echo "3. Check browser console for any errors"
echo "4. Test login functionality"
echo ""
echo "🔗 Manual Testing:"
echo "- Visit your frontend URL"
echo "- Open browser console (F12)"
echo "- Try to login"
echo "- Check for API calls to backend"
echo ""
echo "📱 Environment Variables to Check:"
echo "- Vercel: REACT_APP_API_URL"
echo "- Railway: CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS" 
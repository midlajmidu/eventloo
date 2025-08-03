#!/bin/bash

echo "🧪 TESTING FRONTEND ROUTING"
echo "=================================================="

FRONTEND_URL="https://eventloo-frontend-7vxrwvifna-uc.a.run.app"

echo "📋 Step 1: Testing main page..."
MAIN_RESPONSE=$(curl -s "$FRONTEND_URL/")
echo "Main page status: $(echo "$MAIN_RESPONSE" | head -1)"

echo ""
echo "📋 Step 2: Testing deep route..."
DEEP_RESPONSE=$(curl -s "$FRONTEND_URL/admin/dashboard")
echo "Deep route status: $(echo "$DEEP_RESPONSE" | head -1)"

echo ""
echo "📋 Step 3: Testing JavaScript files..."
JS_RESPONSE=$(curl -s -I "$FRONTEND_URL/static/js/main.9549f3b3.js" | head -1)
echo "JavaScript file status: $JS_RESPONSE"

echo ""
echo "📋 Step 4: Testing CSS files..."
CSS_RESPONSE=$(curl -s -I "$FRONTEND_URL/static/css/main.f2ad2c7f.css" | head -1)
echo "CSS file status: $CSS_RESPONSE"

echo ""
echo "📋 Step 5: Testing backend connectivity from frontend..."
BACKEND_TEST=$(curl -s "$FRONTEND_URL/static/js/main.9549f3b3.js" | grep -o "eventloo-backend" | head -1)
if [ -n "$BACKEND_TEST" ]; then
    echo "✅ Backend URL found in JavaScript"
else
    echo "❌ Backend URL not found in JavaScript"
fi

echo ""
echo "🎯 ANALYSIS:"
echo "=================================================="

if [[ "$MAIN_RESPONSE" == *"<!doctype html>"* ]] && [[ "$DEEP_RESPONSE" == *"<!doctype html>"* ]]; then
    echo "✅ SPA ROUTING: WORKING"
    echo "   - Both main page and deep routes return HTML"
    echo "   - Server-side routing is configured correctly"
else
    echo "❌ SPA ROUTING: FAILED"
    echo "   - Deep routes not returning HTML"
fi

if [[ "$JS_RESPONSE" == *"200"* ]]; then
    echo "✅ JAVASCRIPT FILES: LOADING"
    echo "   - JavaScript files are accessible"
else
    echo "❌ JAVASCRIPT FILES: FAILED"
    echo "   - JavaScript files not loading"
fi

if [[ "$CSS_RESPONSE" == *"200"* ]]; then
    echo "✅ CSS FILES: LOADING"
    echo "   - CSS files are accessible"
else
    echo "❌ CSS FILES: FAILED"
    echo "   - CSS files not loading"
fi

echo ""
echo "🔍 POSSIBLE ISSUES:"
echo "=================================================="
echo "1. JavaScript errors in browser console"
echo "2. Backend API URL mismatch"
echo "3. CORS issues"
echo "4. Authentication token issues"
echo "5. React Router configuration"

echo ""
echo "🌐 MANUAL TESTING STEPS:"
echo "=================================================="
echo "1. Open browser developer tools (F12)"
echo "2. Go to: $FRONTEND_URL/admin/dashboard"
echo "3. Check Console tab for errors"
echo "4. Check Network tab for failed requests"
echo "5. Look for 'Unexpected token <' errors"

echo ""
echo "🔧 QUICK FIXES TO TRY:"
echo "=================================================="
echo "1. Clear browser cache and cookies"
echo "2. Try incognito/private browsing"
echo "3. Check if backend API is accessible"
echo "4. Verify authentication is working" 
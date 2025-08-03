#!/bin/bash

# Test Railway + Vercel Deployment
echo "🚀 Testing Railway + Vercel Deployment"
echo "======================================"

# Get backend URL from user
echo "Enter your Railway backend URL (e.g., https://eventloo-backend.railway.app):"
read BACKEND_URL

# Get frontend URL from user
echo "Enter your Vercel frontend URL (e.g., https://eventloo-frontend.vercel.app):"
read FRONTEND_URL

echo ""
echo "🔧 Testing Backend..."
echo "===================="

# Test backend health
echo "1. Testing backend health..."
HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/")
if [[ $HEALTH_RESPONSE == *"Django"* ]] || [[ $HEALTH_RESPONSE == *"Welcome"* ]]; then
    echo "✅ Backend is running"
else
    echo "❌ Backend health check failed"
    echo "Response: $HEALTH_RESPONSE"
fi

# Test create admin user
echo ""
echo "2. Testing admin user creation..."
ADMIN_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123", "email": "admin@eventloo.com", "first_name": "Admin", "last_name": "User", "role": "admin"}' \
  "$BACKEND_URL/api/create-admin-user/")

if [[ $ADMIN_RESPONSE == *"success"* ]] || [[ $ADMIN_RESPONSE == *"created"* ]]; then
    echo "✅ Admin user created successfully"
else
    echo "❌ Admin user creation failed"
    echo "Response: $ADMIN_RESPONSE"
fi

# Test login
echo ""
echo "3. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email": "admin@eventloo.com", "password": "admin123"}' \
  "$BACKEND_URL/api/token/")

if [[ $LOGIN_RESPONSE == *"access"* ]] || [[ $LOGIN_RESPONSE == *"token"* ]]; then
    echo "✅ Login works"
else
    echo "❌ Login failed"
    echo "Response: $LOGIN_RESPONSE"
fi

echo ""
echo "🌐 Testing Frontend..."
echo "====================="

# Test frontend accessibility
echo "4. Testing frontend accessibility..."
FRONTEND_RESPONSE=$(curl -s -I "$FRONTEND_URL" | head -1)
if [[ $FRONTEND_RESPONSE == *"200"* ]]; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend accessibility failed"
    echo "Response: $FRONTEND_RESPONSE"
fi

echo ""
echo "🔗 Testing Frontend-Backend Connection..."
echo "========================================"

# Test if frontend can reach backend
echo "5. Testing frontend-backend connection..."
echo "Open your browser and go to: $FRONTEND_URL"
echo "Then open browser developer tools (F12) and check:"
echo "  - Console tab for any errors"
echo "  - Network tab for API calls"
echo "  - Try to login with: admin@eventloo.com / admin123"

echo ""
echo "📋 Manual Testing Checklist:"
echo "============================"
echo "✅ Backend URL: $BACKEND_URL"
echo "✅ Frontend URL: $FRONTEND_URL"
echo ""
echo "🔍 Check these in browser:"
echo "1. Open: $FRONTEND_URL"
echo "2. Open browser developer tools (F12)"
echo "3. Go to Console tab"
echo "4. Try to login with: admin@eventloo.com / admin123"
echo "5. Check for any CORS errors in console"
echo "6. Check if dashboard loads after login"

echo ""
echo "🚨 If you see CORS errors:"
echo "1. Go to Railway dashboard"
echo "2. Add environment variable: CORS_ALLOWED_ORIGINS"
echo "3. Set value to: $FRONTEND_URL"
echo "4. Redeploy backend"

echo ""
echo "✅ Deployment Test Complete!"
echo "===========================" 
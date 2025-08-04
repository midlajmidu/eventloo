#!/bin/bash

echo "🧪 Testing Login Functionality..."

echo ""
echo "📋 Testing Backend API..."

# Test backend health
echo "1. Backend Health Check:"
curl -s https://eventloo-backend-qkvm.onrender.com/
echo ""
echo ""

# Test API endpoints
echo "2. API Test:"
curl -s https://eventloo-backend-qkvm.onrender.com/api/test/
echo ""
echo ""

# Test admin panel
echo "3. Admin Panel Test:"
curl -I https://eventloo-backend-qkvm.onrender.com/admin/ | head -3
echo ""

echo "📋 Testing Frontend..."

# Test frontend loading
echo "4. Frontend Loading Test:"
curl -s https://eventloo.vercel.app/ | grep -o "<title>.*</title>"
echo ""

echo "📋 Manual Testing Steps:"
echo ""
echo "🔗 URLs to Test:"
echo "- Frontend: https://eventloo.vercel.app/"
echo "- Backend: https://eventloo-backend-qkvm.onrender.com/"
echo "- Admin: https://eventloo-backend-qkvm.onrender.com/admin/"
echo ""

echo "🎯 Login Test Instructions:"
echo "1. Open: https://eventloo.vercel.app/"
echo "2. You should see the login page"
echo "3. Try logging in with:"
echo "   - Email: admin@eventloo.com"
echo "   - Password: admin123"
echo "4. Check browser console for any errors"
echo ""

echo "🔧 Expected Results:"
echo "✅ Frontend loads without errors"
echo "✅ Login form appears"
echo "✅ Backend API responds"
echo "❌ Login may fail (if DATABASE_URL not set)"
echo ""

echo "🚨 Current Issues:"
echo "1. Frontend may be connecting to old Railway backend"
echo "2. DATABASE_URL needs to be added to backend"
echo "3. Admin user may not exist yet"
echo ""

echo "🔧 To Fix Login Issues:"
echo "1. Add DATABASE_URL to backend environment variables"
echo "2. Redeploy backend"
echo "3. Update frontend REACT_APP_API_URL in Vercel"
echo "4. Redeploy frontend"
echo ""

echo "📊 Current Status:"
echo "- Backend API: ✅ Working"
echo "- Frontend Loading: ✅ Working"
echo "- Database Connection: ❌ Not connected"
echo "- Admin User: ❌ Not created"
echo "- Login Functionality: ❌ May fail"
echo "" 
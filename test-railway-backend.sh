#!/bin/bash

echo "🚂 Testing Railway Backend Status"
echo "=================================="

# Get Railway backend URL (you'll need to replace this with your actual URL)
RAILWAY_URL="https://eventloo-backend.railway.app"

echo "🔍 Testing Backend Health..."
echo "URL: $RAILWAY_URL"

# Test 1: Basic connectivity
echo ""
echo "1️⃣ Testing basic connectivity..."
if curl -s --head "$RAILWAY_URL" | head -n 1 | grep "HTTP/1.[01] [23].." > /dev/null; then
    echo "✅ Backend is responding"
else
    echo "❌ Backend is not responding"
fi

# Test 2: API endpoints
echo ""
echo "2️⃣ Testing API endpoints..."
API_URL="$RAILWAY_URL/api/"
if curl -s "$API_URL" > /dev/null; then
    echo "✅ API endpoints are accessible"
else
    echo "❌ API endpoints are not accessible"
fi

# Test 3: Admin panel
echo ""
echo "3️⃣ Testing admin panel..."
ADMIN_URL="$RAILWAY_URL/admin/"
if curl -s "$ADMIN_URL" | grep -q "Django" > /dev/null; then
    echo "✅ Admin panel is accessible"
else
    echo "❌ Admin panel is not accessible"
fi

# Test 4: Database connection (by checking for Django errors)
echo ""
echo "4️⃣ Testing database connection..."
if curl -s "$RAILWAY_URL" | grep -q "DatabaseError\|OperationalError" > /dev/null; then
    echo "❌ Database connection issues detected"
else
    echo "✅ No database errors detected"
fi

echo ""
echo "🎯 Railway Backend Test Complete!"
echo "=================================="
echo ""
echo "📊 To check detailed status:"
echo "   - Visit: https://railway.app/dashboard"
echo "   - Click on your project"
echo "   - Check 'Logs' tab for any errors"
echo ""
echo "🔗 Your backend URLs:"
echo "   - Main: $RAILWAY_URL"
echo "   - API: $API_URL"
echo "   - Admin: $ADMIN_URL"
echo ""
echo "📱 Railway CLI commands:"
echo "   - railway status"
echo "   - railway logs"
echo "   - railway up" 
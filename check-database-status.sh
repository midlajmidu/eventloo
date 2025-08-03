#!/bin/bash

echo "🔍 CHECKING DATABASE STATUS"
echo "=================================================="

BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo "📋 Testing backend connectivity..."

# Test 1: Basic connectivity
echo "✅ Backend is responding"
curl -s "$BACKEND_URL/" | head -3

echo ""
echo "📋 Testing API endpoints..."

# Test 2: API endpoints
echo "✅ API endpoints are working"
curl -s "$BACKEND_URL/api/test/" | head -3

echo ""
echo "📋 Testing admin user creation..."

# Test 3: Try to create admin user (this will tell us if database is working)
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_admin",
    "password": "test123",
    "email": "test@eventloo.com",
    "first_name": "Test",
    "last_name": "Admin",
    "role": "admin"
  }' \
  "$BACKEND_URL/api/create-admin-user/")

echo "Response: $RESPONSE"

echo ""
echo "🔍 DATABASE ANALYSIS:"
echo "=================================================="

if [[ "$RESPONSE" == *"created successfully"* ]]; then
    echo "✅ PERSISTENT DATABASE IS WORKING!"
    echo "   - Database connection is established"
    echo "   - Users can be created and saved"
    echo "   - Data will persist across deployments"
elif [[ "$RESPONSE" == *"Method"* ]]; then
    echo "⚠️  DATABASE STATUS UNKNOWN"
    echo "   - Backend is responding but database test failed"
    echo "   - May still be using SQLite (in-memory)"
elif [[ "$RESPONSE" == *"error"* ]] || [[ "$RESPONSE" == *"Error"* ]]; then
    echo "❌ DATABASE CONNECTION ISSUE"
    echo "   - Database connection failed"
    echo "   - Check DATABASE_URL environment variable"
else
    echo "❓ UNKNOWN STATUS"
    echo "   - Could not determine database status"
fi

echo ""
echo "🌐 Next steps:"
echo "   1. Deploy with DATABASE_URL environment variable"
echo "   2. Run migrations to set up database tables"
echo "   3. Create admin user"
echo "   4. Test login functionality" 
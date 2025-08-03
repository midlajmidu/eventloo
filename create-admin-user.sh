#!/bin/bash

echo "🔧 CREATING ADMIN USER"
echo "=================================================="

BACKEND_URL="https://eventloo-backend-7vxrwvifna-uc.a.run.app"

echo "📋 Creating admin user via API..."

# Create admin user via POST request
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "email": "admin@eventloo.com",
    "first_name": "Admin",
    "last_name": "User",
    "role": "admin"
  }' \
  "$BACKEND_URL/api/create-admin-user/"

echo ""
echo "✅ Admin user creation attempted!"
echo "🔑 Default credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "🌐 Try logging in at: https://eventloo-frontend-7vxrwvifna-uc.a.run.app" 
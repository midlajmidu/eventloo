#!/bin/bash

echo "🔍 FINDING YOUR DATABASE USERNAME"
echo "=================================================="

echo "📋 STEP 1: Check Google Cloud SQL Console"
echo "=================================================="
echo "1. Go to: https://console.cloud.google.com/sql/instances"
echo "2. Select project: 7vxrwvifna"
echo "3. Click on: eventloo-db"
echo "4. Go to: USERS tab"
echo "5. Look for the username you created"
echo ""

echo "📋 STEP 2: Common Username Patterns"
echo "=================================================="
echo "Your username might be one of these:"
echo "- eventloo_user"
echo "- eventloo_admin"
echo "- eventloo"
echo "- admin"
echo "- root"
echo "- postgres"
echo ""

echo "📋 STEP 3: Check Database Connection"
echo "=================================================="
echo "Try these DATABASE_URL patterns:"
echo ""

echo "Pattern 1:"
echo "postgres://eventloo_user:Macbook@1234@35.194.18.12:5432/eventloo_db"
echo ""

echo "Pattern 2:"
echo "postgres://eventloo_admin:Macbook@1234@35.194.18.12:5432/eventloo_db"
echo ""

echo "Pattern 3:"
echo "postgres://eventloo:Macbook@1234@35.194.18.12:5432/eventloo_db"
echo ""

echo "Pattern 4:"
echo "postgres://admin:Macbook@1234@35.194.18.12:5432/eventloo_db"
echo ""

echo "📋 STEP 4: Test Each Pattern"
echo "=================================================="
echo "After updating DATABASE_URL in backend, test with:"
echo ""

echo "Test 1:"
echo "curl -X POST -H \"Content-Type: application/json\" \\"
echo "  -d '{\"username\": \"admin\", \"password\": \"admin123\", \"email\": \"admin@eventloo.com\", \"first_name\": \"Admin\", \"last_name\": \"User\", \"role\": \"admin\"}' \\"
echo "  \"https://eventloo-backend-7vxrwvifna-uc.a.run.app/api/create-admin-user/\""
echo ""

echo "✅ EXPECTED SUCCESS:"
echo "{\"message\":\"Admin user created successfully\",...}"
echo ""

echo "❌ EXPECTED FAILURE:"
echo "{\"error\":\"Error creating user: invalid dsn: invalid connection option...\"}"
echo ""

echo "🌐 QUICK LINKS:"
echo "=================================================="
echo "🔗 Cloud SQL Console: https://console.cloud.google.com/sql/instances"
echo "🔗 Cloud Run Console: https://console.cloud.google.com/run"
echo "🔗 Your Backend: https://eventloo-backend-7vxrwvifna-uc.a.run.app" 
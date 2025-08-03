#!/bin/bash

echo "🚀 REDEPLOYING BACKEND NOW"
echo "=================================================="

echo "📋 Your Database Details:"
echo "   Username: eventloo-db"
echo "   Password: Macbook@1234"
echo "   Host: 35.194.18.12"
echo "   Database: eventloo_db"
echo ""

echo "🔗 DATABASE_URL:"
echo "postgres://eventloo-db:Macbook@1234@35.194.18.12:5432/eventloo_db"
echo ""

echo "📋 MANUAL STEPS TO REDEPLOY:"
echo "=================================================="
echo "1. Go to: https://console.cloud.google.com/run"
echo "2. Select project: 7vxrwvifna"
echo "3. Find service: eventloo-backend"
echo "4. Click 'EDIT & DEPLOY NEW REVISION'"
echo "5. Find DATABASE_URL environment variable"
echo "6. Change value to: postgres://eventloo-db:Macbook@1234@35.194.18.12:5432/eventloo_db"
echo "7. Click 'DEPLOY'"
echo "8. Wait 5-10 minutes"
echo ""

echo "🧪 AFTER DEPLOYMENT - TEST:"
echo "=================================================="
echo "curl -X POST -H \"Content-Type: application/json\" \\"
echo "  -d '{\"username\": \"admin\", \"password\": \"admin123\", \"email\": \"admin@eventloo.com\", \"first_name\": \"Admin\", \"last_name\": \"User\", \"role\": \"admin\"}' \\"
echo "  \"https://eventloo-backend-7vxrwvifna-uc.a.run.app/api/create-admin-user/\""
echo ""

echo "✅ EXPECTED SUCCESS:"
echo "{\"message\":\"Admin user created successfully\",...}"
echo ""

echo "❌ CURRENT ERROR (will be fixed after redeploy):"
echo "{\"error\":\"Error creating user: invalid dsn: invalid connection option \"MAX_CONNS\"\"}"
echo ""

echo "🌐 QUICK LINKS:"
echo "=================================================="
echo "🔗 Cloud Run Console: https://console.cloud.google.com/run"
echo "🔗 Your Backend: https://eventloo-backend-7vxrwvifna-uc.a.run.app"
echo "🔗 Your Frontend: https://eventloo-frontend-7vxrwvifna-uc.a.run.app" 
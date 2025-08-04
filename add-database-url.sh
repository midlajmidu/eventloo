#!/bin/bash

echo "🔧 Adding DATABASE_URL to Backend Service..."

echo ""
echo "📋 Database URL:"
echo "postgresql://eventloo_user:052KuP2gdeN3hqdXuPw4d1Atwm5OofsV@dpg-d27lkk49c44c73f5pp8g-a.oregon-postgres.render.com/eventloo_db"
echo ""

echo "🚀 Steps to Add DATABASE_URL:"
echo "1. Go to: https://dashboard.render.com/"
echo "2. Find your backend service: eventloo-backend-qkvm"
echo "3. Click on the backend service"
echo "4. Go to 'Environment' tab"
echo "5. Add new environment variable:"
echo ""

echo "🔧 Environment Variable:"
echo "┌─────────────────────────┬─────────────────────────────────────────────────────┐"
echo "│ Variable Name           │ Value                                               │"
echo "├─────────────────────────┼─────────────────────────────────────────────────────┤"
echo "│ DATABASE_URL            │ postgresql://eventloo_user:052KuP2gdeN3hqdXuPw4d1Atwm5OofsV@dpg-d27lkk49c44c73f5pp8g-a.oregon-postgres.render.com/eventloo_db │"
echo "└─────────────────────────┴─────────────────────────────────────────────────────┘"
echo ""

echo "📋 After adding DATABASE_URL:"
echo "1. Go to 'Deployments' tab"
echo "2. Click 'Redeploy' on your latest deployment"
echo "3. Wait for deployment to complete"
echo ""

echo "🎯 Expected Results:"
echo "✅ Database migrations will run successfully"
echo "✅ Admin user will be created automatically"
echo "✅ All data will be stored persistently"
echo "✅ Login functionality will work"
echo "✅ Admin panel will be accessible"
echo ""

echo "🔗 URLs:"
echo "- Backend: https://eventloo-backend-qkvm.onrender.com/"
echo "- Admin: https://eventloo-backend-qkvm.onrender.com/admin/"
echo "- Frontend: https://eventloo.vercel.app/"
echo ""

echo "🎯 Admin Credentials (will be created automatically):"
echo "- Email: admin@eventloo.com"
echo "- Password: admin123"
echo ""

echo "✅ Current Backend Status:"
curl -s https://eventloo-backend-qkvm.onrender.com/ | head -1
echo "" 
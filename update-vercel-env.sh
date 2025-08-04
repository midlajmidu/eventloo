#!/bin/bash

echo "🔧 Updating Vercel Environment Variables..."

echo ""
echo "📋 Current Issue:"
echo "Your frontend is trying to connect to: https://eventloo-production.up.railway.app"
echo "But it should connect to: https://eventloo-backend-qkvm.onrender.com/api"
echo ""

echo "🚀 Solution: Update Vercel Environment Variables"
echo ""

echo "📋 Steps to Fix:"
echo "1. Go to: https://vercel.com/dashboard"
echo "2. Find your 'eventloo' project"
echo "3. Click on 'Settings' tab"
echo "4. Click on 'Environment Variables'"
echo "5. Update the following variables:"
echo ""

echo "🔧 Environment Variables to Update:"
echo "┌─────────────────────────┬─────────────────────────────────────────────────────┐"
echo "│ Variable Name           │ Value                                               │"
echo "├─────────────────────────┼─────────────────────────────────────────────────────┤"
echo "│ REACT_APP_API_URL      │ https://eventloo-backend-qkvm.onrender.com/api     │"
echo "│ NODE_ENV               │ production                                          │"
echo "└─────────────────────────┴─────────────────────────────────────────────────────┘"
echo ""

echo "📋 After updating environment variables:"
echo "1. Go to 'Deployments' tab"
echo "2. Click 'Redeploy' on your latest deployment"
echo "3. Wait for the new deployment to complete"
echo ""

echo "🧪 Test Commands:"
echo "# Test backend is working:"
echo "curl https://eventloo-backend-qkvm.onrender.com/"
echo ""
echo "# Test API endpoint:"
echo "curl https://eventloo-backend-qkvm.onrender.com/api/test/"
echo ""

echo "🎯 Expected Result:"
echo "After redeployment, your frontend should connect to the Render backend"
echo "and login should work properly."
echo ""

echo "🔗 URLs:"
echo "- Frontend: https://eventloo.vercel.app/"
echo "- Backend: https://eventloo-backend-qkvm.onrender.com/"
echo "- Admin: https://eventloo-backend-qkvm.onrender.com/admin/"
echo ""

echo "✅ Backend Status Check:"
curl -s https://eventloo-backend-qkvm.onrender.com/ | head -1
echo ""
curl -s https://eventloo-backend-qkvm.onrender.com/api/test/ | head -1
echo "" 
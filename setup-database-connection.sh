#!/bin/bash

echo "🔧 Setting up Database Connection on Render..."

echo ""
echo "📋 Current Issue:"
echo "Backend is trying to connect to localhost instead of Render PostgreSQL"
echo "Error: connection to server at 'localhost' (::1), port 5432 failed"
echo ""

echo "🚀 Solution: Manual Database Setup on Render"
echo ""

echo "📋 Steps to Fix:"
echo "1. Go to: https://dashboard.render.com/"
echo "2. Find your 'eventloo-backend-qkvm' service"
echo "3. Click on 'Environment' tab"
echo "4. Add the following environment variable:"
echo ""

echo "🔧 Environment Variable to Add:"
echo "┌─────────────────────────┬─────────────────────────────────────────────────────┐"
echo "│ Variable Name           │ Value                                               │"
echo "├─────────────────────────┼─────────────────────────────────────────────────────┤"
echo "│ DATABASE_URL            │ (Get this from your PostgreSQL service)            │"
echo "└─────────────────────────┴─────────────────────────────────────────────────────┘"
echo ""

echo "📋 How to get DATABASE_URL:"
echo "1. Go to: https://dashboard.render.com/"
echo "2. Find your PostgreSQL database service"
echo "3. Click on the database service"
echo "4. Go to 'Connections' tab"
echo "5. Copy the 'External Database URL'"
echo "6. Add this as DATABASE_URL environment variable in your backend service"
echo ""

echo "🧪 Test Commands:"
echo "# Check if database is accessible:"
echo "curl -s https://eventloo-backend-qkvm.onrender.com/ | head -1"
echo ""

echo "🎯 Expected Result:"
echo "After adding DATABASE_URL, the backend should:"
echo "1. Connect to Render PostgreSQL database"
echo "2. Run migrations successfully"
echo "3. Create admin user"
echo "4. Start serving requests"
echo ""

echo "🔗 Database Service Info:"
echo "- Database ID: dpg-d27lkk49c44c73f5pp8g-a"
echo "- Database Name: eventloo_db"
echo "- User: eventloo_user"
echo "- Plan: Free"
echo ""

echo "✅ Backend Status Check:"
curl -s https://eventloo-backend-qkvm.onrender.com/ | head -1
echo "" 
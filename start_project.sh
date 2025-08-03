#!/bin/bash

echo "🚀 Starting Eventloo Project..."

# Check if PostgreSQL is running
echo "📊 Checking PostgreSQL..."
if ! brew services list | grep postgresql@14 | grep started > /dev/null; then
    echo "Starting PostgreSQL..."
    brew services start postgresql@14
    sleep 2
else
    echo "PostgreSQL is already running"
fi

# Start Backend
echo "🔧 Starting Django Backend..."
cd backend
python3 manage.py runserver 8000 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Start Frontend
echo "🎨 Starting React Frontend..."
cd ../frontend
npm start &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

# Wait for frontend to start
sleep 5

echo ""
echo "✅ Project is starting up!"
echo ""
echo "🌐 Access your application:"
echo "   Backend API:  http://localhost:8000"
echo "   Frontend App: http://localhost:3000"
echo "   Admin Panel:  http://localhost:8000/admin/"
echo ""
echo "📊 Database: PostgreSQL (eventloo_db)"
echo "👤 Admin User: admin@eventloo.com"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait 
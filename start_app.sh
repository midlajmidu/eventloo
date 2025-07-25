#!/bin/bash

# School Event Management System Launcher
# This script starts both the Django backend and React frontend

echo "🚀 Starting School Event Management System..."
echo "=============================================="

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "❌ Port $1 is already in use. Please stop the service using port $1 first."
        return 1
    fi
    return 0
}

# Check if ports are available
echo "🔍 Checking port availability..."
if ! check_port 8000; then
    exit 1
fi
if ! check_port 3000; then
    exit 1
fi

echo "✅ Ports are available"

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start Django backend
echo "🐍 Starting Django backend on http://localhost:8000..."
cd backend
python3 manage.py runserver 0.0.0.0:8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Failed to start Django backend. Check backend.log for details."
    exit 1
fi

echo "✅ Django backend started (PID: $BACKEND_PID)"

# Start React frontend
echo "⚛️  Starting React frontend on http://localhost:3000..."
cd frontend
npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 5

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Failed to start React frontend. Check frontend.log for details."
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ React frontend started (PID: $FRONTEND_PID)"

echo ""
echo "🎉 School Event Management System is now running!"
echo "=============================================="
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000/api/"
echo "📊 Admin Panel: http://localhost:8000/admin/"
echo ""
echo "🔐 Demo Login Credentials:"
echo "   Admin: admin@school.com / admin123"
echo "   Manager: manager@school.com / manager123"
echo "   Team Manager: teammanager1@school.com / admin123"
echo ""
echo "💡 Press Ctrl+C to stop both servers"
echo "📝 Logs are saved in backend.log and frontend.log"
echo ""

# Wait for user to stop the servers
wait 
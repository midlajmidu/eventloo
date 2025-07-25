#!/bin/bash

echo "🏫 School Event Management System Setup"
echo "======================================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

echo "✅ Prerequisites check passed!"

# Setup backend
echo ""
echo "🔧 Setting up Django backend..."
cd backend

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r ../requirements.txt

# Run migrations
echo "🗃️ Setting up database..."
python3 manage.py makemigrations
python3 manage.py migrate

# Create demo users
echo "👥 Creating demo users..."
python3 manage.py create_demo_users

echo "✅ Backend setup completed!"

# Setup frontend
echo ""
echo "🔧 Setting up React frontend..."
cd ../frontend

# Install Node dependencies
echo "📦 Installing Node.js dependencies..."
npm install

echo "✅ Frontend setup completed!"

cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "🚀 To start the application:"
echo ""
echo "Backend (Terminal 1):"
echo "  cd backend"
echo "  python3 manage.py runserver"
echo ""
echo "Frontend (Terminal 2):"
echo "  cd frontend"
echo "  npm start"
echo ""
echo "🌐 Application URLs:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:8000"
echo "  Django Admin: http://localhost:8000/admin"
echo ""
echo "👥 Demo Login Credentials:"
echo "  Admin: admin@school.com / admin123"
echo "  Event Manager: manager@school.com / manager123"
echo ""
echo "Happy coding! 🎓" 
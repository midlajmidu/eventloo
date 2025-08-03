#!/bin/bash

echo "🚀 Starting Eventloo backend deployment..."

# Change to backend directory
cd backend

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Run database migrations
echo "🗄️ Running database migrations..."
python manage.py migrate

# Create admin user
echo "👤 Creating admin user..."
python manage.py create_admin_user

echo "✅ Build completed successfully!" 
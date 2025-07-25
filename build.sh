#!/bin/bash

# Render deployment build script
echo "Starting build process for Render deployment..."

# Install Python dependencies
echo "Installing Python dependencies..."
cd backend && pip install -r requirements.txt && cd ..

# Install Node.js dependencies and build frontend
echo "Installing Node.js dependencies and building frontend..."
cd frontend
npm install
npm run build
cd ..

# Collect static files for Django
echo "Collecting Django static files..."
cd backend
python manage.py collectstatic --noinput
cd ..

echo "Build completed successfully!" 
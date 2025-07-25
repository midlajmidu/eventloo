#!/bin/bash

# Eventloo Backend Server Startup Script
echo "🚀 Starting Eventloo Backend Server..."

# Navigate to backend directory
cd "$(dirname "$0")/backend"

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Error: Python is not installed or not in PATH"
    echo "Please install Python 3 and try again"
    exit 1
fi

# Check if manage.py exists
if [ ! -f "manage.py" ]; then
    echo "❌ Error: manage.py not found in backend directory"
    echo "Please ensure you're running this script from the project root"
    exit 1
fi

# Check if requirements are installed
echo "📦 Checking dependencies..."
if ! $PYTHON_CMD -c "import django" &> /dev/null; then
    echo "⚠️  Django not found. Installing requirements..."
    if [ -f "requirements.txt" ]; then
        pip3 install -r requirements.txt
    else
        echo "❌ requirements.txt not found"
        exit 1
    fi
fi

# Check if database exists and run migrations if needed
if [ ! -f "db.sqlite3" ]; then
    echo "🗄️  Database not found. Running migrations..."
    $PYTHON_CMD manage.py migrate
fi

# Start the server
echo "🌐 Starting Django development server on http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""

$PYTHON_CMD manage.py runserver 8000 
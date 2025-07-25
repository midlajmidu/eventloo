@echo off
title School Event Management System Launcher

echo 🚀 Starting School Event Management System...
echo ==============================================

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js 16+ and try again
    pause
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed or not in PATH
    echo Please install npm and try again
    pause
    exit /b 1
)

echo ✅ Dependencies checked

REM Start Django backend
echo 🐍 Starting Django backend on http://localhost:8000...
cd backend
start "Django Backend" cmd /k "python manage.py runserver 0.0.0.0:8000"
cd ..

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start React frontend
echo ⚛️ Starting React frontend on http://localhost:3000...
cd frontend
start "React Frontend" cmd /k "npm start"
cd ..

REM Wait a moment for frontend to start
timeout /t 5 /nobreak >nul

echo.
echo 🎉 School Event Management System is now running!
echo ==============================================
echo 🌐 Frontend: http://localhost:3000
echo 🔧 Backend API: http://localhost:8000/api/
echo 📊 Admin Panel: http://localhost:8000/admin/
echo.
echo 🔐 Demo Login Credentials:
echo    Admin: admin@school.com / admin123
echo    Manager: manager@school.com / manager123
echo    Team Manager: teammanager1@school.com / admin123
echo.
echo 💡 Close the command windows to stop the servers
echo.

pause 
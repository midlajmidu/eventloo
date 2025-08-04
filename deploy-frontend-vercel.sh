#!/bin/bash

echo "🚀 Deploying Eventloo Frontend to Vercel..."

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Build the frontend
echo "📦 Building frontend..."
cd frontend
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Check if Vercel CLI is available
if command -v vercel &> /dev/null; then
    echo "🔧 Vercel CLI found, deploying..."
    vercel --prod
else
    echo "📋 Vercel CLI not found. Please deploy manually:"
    echo ""
    echo "1. Go to https://vercel.com"
    echo "2. Import your GitHub repository: https://github.com/midlajmidu/eventloo"
    echo "3. Set the following environment variables:"
    echo "   - REACT_APP_API_URL=https://eventloo-backend-qkvm.onrender.com/api"
    echo "   - NODE_ENV=production"
    echo "4. Set the root directory to: frontend"
    echo "5. Deploy!"
    echo ""
    echo "🔗 Your backend is ready at: https://eventloo-backend-qkvm.onrender.com/"
    echo "🔗 Your frontend will be available at: https://eventloo.vercel.app/"
fi

echo ""
echo "🎉 Deployment instructions completed!"
echo ""
echo "📋 Manual Deployment Steps:"
echo "1. Visit: https://vercel.com/new"
echo "2. Import: https://github.com/midlajmidu/eventloo"
echo "3. Configure:"
echo "   - Framework Preset: Create React App"
echo "   - Root Directory: frontend"
echo "   - Build Command: npm run build"
echo "   - Output Directory: build"
echo "4. Environment Variables:"
echo "   - REACT_APP_API_URL=https://eventloo-backend-qkvm.onrender.com/api"
echo "   - NODE_ENV=production"
echo "5. Deploy!"
echo ""
echo "🔗 Backend URL: https://eventloo-backend-qkvm.onrender.com/"
echo "🔗 Frontend URL: https://eventloo.vercel.app/" 
#!/bin/bash

echo "🚀 Testing Eventloo Backend Deployment..."

# Test the main deployment URL
echo "Testing: https://eventloo-backend-qkvm.onrender.com/"
curl -s -w "HTTP Status: %{http_code}\n" https://eventloo-backend-qkvm.onrender.com/ | head -10

echo ""
echo "Testing: https://eventloo-backend-ujuv.onrender.com/"
curl -s -w "HTTP Status: %{http_code}\n" https://eventloo-backend-ujuv.onrender.com/ | head -10

echo ""
echo "Testing: https://eventloo-backend.onrender.com/"
curl -s -w "HTTP Status: %{http_code}\n" https://eventloo-backend.onrender.com/ | head -10

echo ""
echo "✅ Deployment Status Summary:"
echo "   - Service 1: eventloo-backend-qkvm.onrender.com"
echo "   - Service 2: eventloo-backend-ujuv.onrender.com" 
echo "   - Service 3: eventloo-backend.onrender.com"
echo ""
echo "🔧 Next Steps:"
echo "   1. Check Render dashboard for deployment status"
echo "   2. Monitor logs for any remaining issues"
echo "   3. Test API endpoints once deployment is live" 
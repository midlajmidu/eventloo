#!/bin/bash

echo "🚀 DEPLOYING FRONTEND WITH FIXED BACKEND URL"
echo "=================================================="

# Set project and service details
PROJECT_ID="7vxrwvifna"
SERVICE_NAME="eventloo-frontend"
REGION="us-central1"

echo "📋 Deploying frontend with corrected backend URL..."
echo "🔧 Project: $PROJECT_ID"
echo "🔧 Service: $SERVICE_NAME"
echo "🔧 Region: $REGION"
echo "🔧 Backend URL: https://eventloo-backend-7vxrwvifna-uc.a.run.app"

# Build and deploy
gcloud run deploy $SERVICE_NAME \
  --source frontend \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --set-env-vars="REACT_APP_API_URL=https://eventloo-backend-7vxrwvifna-uc.a.run.app,NODE_ENV=production" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 300

if [ $? -eq 0 ]; then
    echo "✅ Frontend deployed successfully!"
    echo "🌐 Frontend URL: https://$SERVICE_NAME-$PROJECT_ID-$REGION.a.run.app"
    echo ""
    echo "🔑 Login Credentials:"
    echo "   Email: admin@eventloo.com"
    echo "   Password: admin123"
    echo ""
    echo "🌐 Login URL: https://$SERVICE_NAME-$PROJECT_ID-$REGION.a.run.app"
    echo ""
    echo "💡 The blank page issue should now be resolved!"
    echo "   - Backend URL is now correct"
    echo "   - Authentication should work properly"
    echo "   - Page reloads should work without errors"
else
    echo "❌ Frontend deployment failed!"
    exit 1
fi 
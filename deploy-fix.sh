#!/bin/bash

# Deploy fix for 505 errors
echo "🚀 Deploying fixes for 505 errors..."

# Build and deploy
gcloud builds submit --config cloudbuild.yaml

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Check the service status
echo "📊 Checking service status..."
gcloud run services describe eventloo --region=us-central1 --format="value(status.conditions[0].status,status.conditions[0].message)"

# Get the service URL
SERVICE_URL=$(gcloud run services describe eventloo --region=us-central1 --format="value(status.url)")
echo "🌐 Service URL: $SERVICE_URL"

# Test the health endpoint
echo "🏥 Testing health endpoint..."
curl -f "$SERVICE_URL/api/" || echo "❌ Health check failed"

echo "✅ Deployment complete!" 
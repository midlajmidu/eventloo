#!/bin/bash

# Deploy backend to Google Cloud Run
echo "🚀 Deploying backend to Google Cloud Run..."

# Build and deploy
gcloud builds submit --config cloudbuild-backend.yaml

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Check the service status
echo "📊 Checking service status..."
gcloud run services describe eventloo-backend --region=us-central1 --format="value(status.conditions[0].status,status.conditions[0].message)"

# Get the service URL
SERVICE_URL=$(gcloud run services describe eventloo-backend --region=us-central1 --format="value(status.url)")
echo "🌐 Backend Service URL: $SERVICE_URL"

# Test the health endpoint
echo "🏥 Testing health endpoint..."
curl -f "$SERVICE_URL/api/" || echo "❌ Health check failed"

echo "✅ Backend deployment complete!"
echo "🔗 Backend URL: $SERVICE_URL" 
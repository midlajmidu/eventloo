#!/bin/bash

# Deploy frontend to Google Cloud Run
echo "🚀 Deploying frontend to Google Cloud Run..."

# Build and deploy
gcloud builds submit --config cloudbuild-frontend.yaml

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Check the service status
echo "📊 Checking service status..."
gcloud run services describe eventloo-frontend --region=us-central1 --format="value(status.conditions[0].status,status.conditions[0].message)"

# Get the service URL
SERVICE_URL=$(gcloud run services describe eventloo-frontend --region=us-central1 --format="value(status.url)")
echo "🌐 Frontend Service URL: $SERVICE_URL"

# Test the health endpoint
echo "🏥 Testing health endpoint..."
curl -f "$SERVICE_URL/" || echo "❌ Health check failed"

echo "✅ Frontend deployment complete!"
echo "🔗 Frontend URL: $SERVICE_URL" 
#!/bin/bash

echo "🚀 DEPLOYING WITH PERSISTENT DATABASE"
echo "=================================================="

# Set project and service details
PROJECT_ID="7vxrwvifna"
SERVICE_NAME="eventloo-backend"
REGION="us-central1"

# Database configuration
DB_IP="35.194.18.12"
DB_NAME="eventloo_db"
DB_USER="eventloo_user"
DB_PASSWORD="eventloo_secure_password_2024"

echo "📋 Deploying backend with persistent PostgreSQL database..."
echo "🔧 Project: $PROJECT_ID"
echo "🔧 Service: $SERVICE_NAME"
echo "🔧 Region: $REGION"
echo "🔧 Database: $DB_NAME"

# Build and deploy with persistent database
gcloud run deploy $SERVICE_NAME \
  --source backend \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --set-env-vars="DEBUG=false,DJANGO_SETTINGS_MODULE=event_management.settings,SECRET_KEY=eventloo-production-secret-key-2024-change-this-in-production,ALLOWED_HOSTS=localhost,127.0.0.1,.run.app,.googleapis.com,.up.railway.app,eventloo-backend-241540993150.us-central1.run.app,eventloo-backend-uj5wj7uv4a-uc.a.run.app,CORS_ALLOWED_ORIGINS=https://eventloo-uj5wj7uv4a-uc.a.run.app,https://eventloo-us-central1-eventloo.a.run.app,https://eventloo-frontend-326693416937.us-central1.run.app,https://eventloo-frontend-7vxrwvifna-uc.a.run.app,DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@$DB_IP:5432/$DB_NAME" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 300

if [ $? -eq 0 ]; then
    echo "✅ Backend deployed successfully!"
    echo "🌐 Backend URL: https://$SERVICE_NAME-$PROJECT_ID-$REGION.a.run.app"
    
    echo "🔧 Running migrations on persistent database..."
    gcloud run jobs create migrate-db \
      --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
      --region $REGION \
      --project $PROJECT_ID \
      --set-env-vars="DEBUG=false,DJANGO_SETTINGS_MODULE=event_management.settings,SECRET_KEY=eventloo-production-secret-key-2024-change-this-in-production,ALLOWED_HOSTS=localhost,127.0.0.1,.run.app,.googleapis.com,.up.railway.app,eventloo-backend-241540993150.us-central1.run.app,eventloo-backend-uj5wj7uv4a-uc.a.run.app,CORS_ALLOWED_ORIGINS=https://eventloo-uj5wj7uv4a-uc.a.run.app,https://eventloo-us-central1-eventloo.a.run.app,https://eventloo-frontend-326693416937.us-central1.run.app,https://eventloo-frontend-7vxrwvifna-uc.a.run.app,DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@$DB_IP:5432/$DB_NAME" \
      --command="python" \
      --args="manage.py,migrate" \
      --memory 512Mi \
      --cpu 1 \
      --timeout 300
    
    echo "🔧 Creating admin user in persistent database..."
    gcloud run jobs create create-admin \
      --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
      --region $REGION \
      --project $PROJECT_ID \
      --set-env-vars="DEBUG=false,DJANGO_SETTINGS_MODULE=event_management.settings,SECRET_KEY=eventloo-production-secret-key-2024-change-this-in-production,ALLOWED_HOSTS=localhost,127.0.0.1,.run.app,.googleapis.com,.up.railway.app,eventloo-backend-241540993150.us-central1.run.app,eventloo-backend-uj5wj7uv4a-uc.a.run.app,CORS_ALLOWED_ORIGINS=https://eventloo-uj5wj7uv4a-uc.a.run.app,https://eventloo-us-central1-eventloo.a.run.app,https://eventloo-frontend-326693416937.us-central1.run.app,https://eventloo-frontend-7vxrwvifna-uc.a.run.app,DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@$DB_IP:5432/$DB_NAME" \
      --command="python" \
      --args="manage.py,create_admin_user" \
      --memory 512Mi \
      --cpu 1 \
      --timeout 300
    
    echo "✅ Persistent database deployment complete!"
    echo "🔗 Test the backend: https://$SERVICE_NAME-$PROJECT_ID-$REGION.a.run.app/api/health/"
    echo ""
    echo "🔑 Login Credentials:"
    echo "   Username: admin"
    echo "   Password: admin123"
    echo ""
    echo "💾 Data will now persist across deployments!"
else
    echo "❌ Backend deployment failed!"
    exit 1
fi 
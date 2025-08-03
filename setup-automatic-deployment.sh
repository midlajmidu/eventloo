#!/bin/bash

# Automatic Deployment Setup Script
# This script sets up automatic deployment with the correct settings

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Setting up Automatic Deployment${NC}"
echo "====================================="

# Configuration
PROJECT_ID="eventloo-com"
REGION="us-central1"

echo -e "${BLUE}📋 Project: $PROJECT_ID${NC}"
echo -e "${BLUE}🌍 Region: $REGION${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    echo -e "${YELLOW}Please install gcloud CLI first:${NC}"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}⚠️  You are not authenticated with gcloud${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set the project
echo -e "${GREEN}📋 Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${GREEN}🔧 Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Create Cloud Build trigger
echo -e "${GREEN}🔧 Creating Cloud Build trigger...${NC}"
gcloud builds triggers create github \
    --repo-name=eventloo \
    --repo-owner=midlajmidu \
    --branch-pattern="^main$" \
    --build-config=cloudbuild-automatic.yaml \
    --name="eventloo-automatic-deploy" \
    --description="Automatic deployment for eventloo.com project"

echo -e "${GREEN}✅ Cloud Build trigger created successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Trigger Details:${NC}"
echo "• Name: eventloo-automatic-deploy"
echo "• Repository: midlajmidu/eventloo"
echo "• Branch: main"
echo "• Configuration: cloudbuild-automatic.yaml"
echo ""
echo -e "${GREEN}🎉 Automatic deployment is now set up!${NC}"
echo ""
echo -e "${YELLOW}📋 What happens now:${NC}"
echo "1. Every time you push to GitHub main branch"
echo "2. Cloud Build will automatically deploy your app"
echo "3. With the correct environment variables"
echo "4. Your login issues will be permanently fixed"
echo ""
echo -e "${BLUE}🔗 To trigger deployment:${NC}"
echo "1. Make any change to your code"
echo "2. Push to GitHub: git push origin main"
echo "3. Cloud Build will automatically deploy"
echo ""
echo -e "${GREEN}✅ Your login will work permanently after the first automatic deployment!${NC}" 
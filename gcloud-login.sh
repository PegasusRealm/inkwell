#!/bin/bash

# Google Cloud Login Script for InkWell Project
echo "🔐 Setting up Google Cloud access for InkWell project..."

# Set the project ID
PROJECT_ID="inkwell-alpha"

# Login to Google Cloud
echo "📋 Authenticating with Google Cloud..."
gcloud auth login

# Set the default project
echo "🎯 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Set the default region
echo "🌍 Setting default region to us-central1..."
gcloud config set run/region us-central1
gcloud config set functions/region us-central1

# Verify authentication and project setup
echo "✅ Verifying setup..."
gcloud config list
echo ""
echo "📊 Current project info:"
gcloud projects describe $PROJECT_ID

echo ""
echo "🎉 Google Cloud setup complete!"
echo "You can now use gcloud commands to manage your InkWell project."
echo ""
echo "Useful commands:"
echo "  - List Cloud Run services: gcloud run services list"
echo "  - View function logs: gcloud functions logs read [FUNCTION_NAME]"
echo "  - List Cloud Run revisions: gcloud run revisions list --service=[SERVICE_NAME]"
echo "  - Delete old revisions: gcloud run revisions delete [REVISION_NAME]"
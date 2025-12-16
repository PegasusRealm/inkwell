#!/bin/bash

# Deploy Firebase Backend Script
# Deploys Cloud Functions and Firestore rules from the shared backend

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

TARGET="${1:-all}"

if [ ! -d "shared" ]; then
    echo -e "${RED}❌ Error: Must be run from monorepo root${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Deploying Firebase backend...${NC}"
echo ""

cd shared

case $TARGET in
    all)
        echo -e "${YELLOW}→ Deploying functions and rules${NC}"
        firebase deploy --only functions,firestore:rules
        ;;
    functions)
        echo -e "${YELLOW}→ Deploying functions only${NC}"
        firebase deploy --only functions
        ;;
    rules)
        echo -e "${YELLOW}→ Deploying rules only${NC}"
        firebase deploy --only firestore:rules
        ;;
    *)
        echo -e "${RED}❌ Invalid target: $TARGET${NC}"
        echo "Usage: ./deploy-backend.sh [all|functions|rules]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"

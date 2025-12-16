#!/bin/bash

# Push Shared Backend Changes Script
# Commits and pushes changes from the shared backend and updates all projects

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

COMMIT_MESSAGE="${1:-Update shared backend}"

if [ ! -d "shared" ]; then
    echo -e "${RED}❌ Error: Must be run from monorepo root${NC}"
    exit 1
fi

echo -e "${BLUE}📤 Pushing shared backend changes...${NC}"
echo ""

# Navigate to shared
cd shared

# Check if there are changes
if git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  No changes to commit in shared backend${NC}"
else
    echo -e "${YELLOW}→ Committing changes${NC}"
    git add .
    git commit -m "$COMMIT_MESSAGE"
    
    echo -e "${YELLOW}→ Pushing to remote${NC}"
    git push
    
    echo -e "${GREEN}✅ Shared backend pushed${NC}"
fi

# Update parent repo
cd ..
echo -e "${YELLOW}→ Updating monorepo reference${NC}"
git add shared
git commit -m "Update shared submodule reference" || echo "No monorepo changes to commit"
git push

echo ""
echo -e "${GREEN}✅ Shared backend updated across all projects!${NC}"
echo -e "${BLUE}Remember to pull changes in web and mobile projects${NC}"

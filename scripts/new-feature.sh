#!/bin/bash

# New Feature Script
# Helper to start a new feature branch in the appropriate submodule

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT="${1}"
FEATURE_NAME="${2}"

if [ -z "$PROJECT" ] || [ -z "$FEATURE_NAME" ]; then
    echo -e "${RED}Usage: ./new-feature.sh [web|mobile|shared] feature-name${NC}"
    exit 1
fi

if [ ! -d "$PROJECT" ]; then
    echo -e "${RED}❌ Error: Project '$PROJECT' not found${NC}"
    exit 1
fi

echo -e "${BLUE}🌟 Creating new feature branch: $FEATURE_NAME${NC}"
echo ""

cd "$PROJECT"

# Create and checkout new branch
BRANCH_NAME="feature/$FEATURE_NAME"
git checkout -b "$BRANCH_NAME"

echo -e "${GREEN}✅ Created branch: $BRANCH_NAME in $PROJECT${NC}"
echo ""
echo "Next steps:"
echo "  1. Make your changes"
echo "  2. git add . && git commit -m 'Your message'"
echo "  3. git push -u origin $BRANCH_NAME"
echo "  4. Create a Pull Request on GitHub"

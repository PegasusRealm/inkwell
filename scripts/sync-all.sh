#!/bin/bash

# Sync All Projects Script
# Pulls latest changes from all submodules in the InkWell monorepo

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔄 Syncing InkWell Monorepo...${NC}"
echo ""

# Pull parent repo
echo -e "${YELLOW}→ Pulling parent repo${NC}"
git pull

# Update all submodules
echo -e "${YELLOW}→ Updating all submodules${NC}"
git submodule update --remote --merge

echo ""
echo -e "${GREEN}✅ All projects synced successfully!${NC}"
echo ""
echo "Current submodule status:"
git submodule status

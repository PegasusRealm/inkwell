#!/bin/bash

# InkWell Monorepo Setup Script
# This script automates the creation of a Git submodule-based monorepo
# for InkWell web and mobile applications with a shared Firebase backend.

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECTS_DIR="/Users/Grimm/Documents/Pegasus_Realm/15_App_Projects"
CURRENT_PROJECT="inkwell"
GITHUB_USERNAME=""  # Will be prompted

echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  InkWell Monorepo Setup Script                      ║${NC}"
echo -e "${BLUE}║  Creates: shared backend, web app, monorepo        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Function: Print section header
print_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

# Function: Print success message
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function: Print warning message
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function: Print error message
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
print_section "Checking Prerequisites"

if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install Git first."
    exit 1
fi
print_success "Git is installed"

if ! command -v firebase &> /dev/null; then
    print_warning "Firebase CLI not found. You'll need it for deployment."
else
    print_success "Firebase CLI is installed"
fi

# Get GitHub username
print_section "Configuration"
read -p "Enter your GitHub username: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    print_error "GitHub username is required"
    exit 1
fi

print_success "GitHub username: $GITHUB_USERNAME"

# Confirm setup
echo ""
echo "This script will create:"
echo "  1. inkwell-shared (backend code)"
echo "  2. inkwell-web (current project renamed)"
echo "  3. inkwell-monorepo (parent repo)"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Setup cancelled"
    exit 1
fi

# Step 1: Backup current project
print_section "Step 1: Backing Up Current Project"
cd "$PROJECTS_DIR"

if [ -d "${CURRENT_PROJECT}-backup" ]; then
    print_warning "Backup already exists. Skipping backup."
else
    cp -r "$CURRENT_PROJECT" "${CURRENT_PROJECT}-backup"
    print_success "Backup created: ${CURRENT_PROJECT}-backup"
fi

# Step 2: Initialize current project as inkwell-web
print_section "Step 2: Preparing Web Project"
cd "$PROJECTS_DIR/$CURRENT_PROJECT"

if [ ! -d ".git" ]; then
    git init
    print_success "Git initialized in web project"
else
    print_warning "Git already initialized"
fi

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    cat > .gitignore << 'EOF'
node_modules/
.env
.DS_Store
*.log
.firebase/
emulator-data/
functions/node_modules/
EOF
    print_success "Created .gitignore"
fi

# Commit current state
git add .
if git diff-index --quiet HEAD --; then
    print_warning "No changes to commit in web project"
else
    git commit -m "Initial commit - Web app baseline"
    print_success "Committed web project baseline"
fi

# Step 3: Create shared backend repository
print_section "Step 3: Creating Shared Backend Repository"
cd "$PROJECTS_DIR"
SHARED_DIR="inkwell-shared"

if [ -d "$SHARED_DIR" ]; then
    print_warning "$SHARED_DIR already exists. Skipping creation."
else
    mkdir "$SHARED_DIR"
    cd "$SHARED_DIR"
    git init
    
    # Copy shared files
    cp -r "../$CURRENT_PROJECT/functions" ./
    cp "../$CURRENT_PROJECT/firebase.json" ./
    cp "../$CURRENT_PROJECT/firestore.rules" ./
    cp "../$CURRENT_PROJECT/firestore.indexes.json" ./
    
    # Create package.json for shared repo
    cat > package.json << 'EOF'
{
  "name": "inkwell-shared",
  "version": "1.0.0",
  "description": "Shared Firebase backend for InkWell web and mobile apps",
  "main": "functions/index.js",
  "scripts": {
    "deploy": "firebase deploy --only functions,firestore:rules",
    "deploy:functions": "firebase deploy --only functions",
    "deploy:rules": "firebase deploy --only firestore:rules"
  },
  "keywords": ["firebase", "backend", "shared"],
  "license": "UNLICENSED"
}
EOF
    
    # Create README
    cat > README.md << 'EOF'
# InkWell Shared Backend

Shared Firebase backend code for InkWell web and mobile apps.

## Contents
- Cloud Functions (API endpoints, triggers)
- Firestore security rules
- Firestore indexes
- Firebase configuration

## Usage
This repository is used as a Git submodule in both web and mobile projects.

## Deployment

```bash
# Deploy all
npm run deploy

# Deploy functions only
npm run deploy:functions

# Deploy rules only
npm run deploy:rules
```
EOF
    
    # Create .gitignore
    cat > .gitignore << 'EOF'
node_modules/
.env
.DS_Store
*.log
.firebase/
functions/node_modules/
EOF
    
    git add .
    git commit -m "Initial commit - Shared backend"
    print_success "Created shared backend repository"
fi

# Step 4: Create monorepo structure
print_section "Step 4: Creating Monorepo Structure"
cd "$PROJECTS_DIR"
MONOREPO_DIR="inkwell-monorepo"

if [ -d "$MONOREPO_DIR" ]; then
    print_error "$MONOREPO_DIR already exists. Please remove it or rename it first."
    exit 1
fi

mkdir "$MONOREPO_DIR"
cd "$MONOREPO_DIR"
git init

# Create monorepo README
cat > README.md << EOF
# InkWell Monorepo

Unified development environment for InkWell web and mobile applications.

## Structure
- \`shared/\` - Firebase backend (functions, rules, config)
- \`web/\` - Web application  
- \`mobile/\` - React Native mobile app (coming soon)

## Quick Start

### First time setup
\`\`\`bash
git clone --recurse-submodules https://github.com/${GITHUB_USERNAME}/inkwell-monorepo.git
cd inkwell-monorepo
\`\`\`

### Pull latest changes
\`\`\`bash
./scripts/sync-all.sh
\`\`\`

### Deploy backend
\`\`\`bash
cd shared
firebase deploy
\`\`\`

## Development Workflow

See [DEVELOPMENT-WORKFLOW.md](DEVELOPMENT-WORKFLOW.md) for detailed instructions.

## GitHub Repositories

- Main: https://github.com/${GITHUB_USERNAME}/inkwell-monorepo
- Shared: https://github.com/${GITHUB_USERNAME}/inkwell-shared
- Web: https://github.com/${GITHUB_USERNAME}/inkwell-web
- Mobile: https://github.com/${GITHUB_USERNAME}/inkwell-mobile (coming soon)
EOF

# Create .gitignore for monorepo
cat > .gitignore << 'EOF'
.DS_Store
*.log
.env
node_modules/
EOF

# Create scripts directory
mkdir -p scripts

git add .
git commit -m "Initial monorepo setup"
print_success "Created monorepo structure"

# Step 5: Display next steps
print_section "Setup Complete! 🎉"

echo ""
echo -e "${GREEN}Your repositories are ready locally. Next steps:${NC}"
echo ""
echo "1️⃣  Create GitHub repositories:"
echo "   Go to https://github.com/new and create:"
echo "   - ${GITHUB_USERNAME}/inkwell-shared"
echo "   - ${GITHUB_USERNAME}/inkwell-web"
echo "   - ${GITHUB_USERNAME}/inkwell-monorepo"
echo ""
echo "2️⃣  Push shared backend:"
echo "   cd $PROJECTS_DIR/inkwell-shared"
echo "   git remote add origin https://github.com/${GITHUB_USERNAME}/inkwell-shared.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3️⃣  Push web project:"
echo "   cd $PROJECTS_DIR/$CURRENT_PROJECT"
echo "   git remote add origin https://github.com/${GITHUB_USERNAME}/inkwell-web.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "4️⃣  Setup monorepo with submodules:"
echo "   cd $PROJECTS_DIR/$MONOREPO_DIR"
echo "   git submodule add https://github.com/${GITHUB_USERNAME}/inkwell-shared.git shared"
echo "   git submodule add https://github.com/${GITHUB_USERNAME}/inkwell-web.git web"
echo "   git add ."
echo "   git commit -m 'Add submodules'"
echo "   git remote add origin https://github.com/${GITHUB_USERNAME}/inkwell-monorepo.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "5️⃣  Update web to use shared backend:"
echo "   cd $PROJECTS_DIR/$MONOREPO_DIR/web"
echo "   rm -rf functions firebase.json firestore.rules firestore.indexes.json"
echo "   ln -s ../shared/functions ./functions"
echo "   ln -s ../shared/firebase.json ./firebase.json"
echo "   ln -s ../shared/firestore.rules ./firestore.rules"
echo "   ln -s ../shared/firestore.indexes.json ./firestore.indexes.json"
echo "   git add ."
echo "   git commit -m 'Link to shared backend'"
echo "   git push"
echo ""
echo -e "${BLUE}📚 For detailed instructions, see:${NC}"
echo "   - $PROJECTS_DIR/$CURRENT_PROJECT/MONOREPO-SETUP-GUIDE.md"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"

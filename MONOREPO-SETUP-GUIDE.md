# InkWell Monorepo Setup Guide

**Date:** December 16, 2025  
**Purpose:** Unified codebase for web and mobile apps with shared Firebase backend  
**Strategy:** Git submodules with shared core functionality

---

## 🎯 Overview

This guide sets up a monorepo structure that allows you to:

- ✅ Share Firebase functions between web and mobile
- ✅ Make functional changes once, deploy to both platforms
- ✅ Keep web and mobile apps in separate repositories
- ✅ Maintain independent version control
- ✅ Use GitHub for synchronization

---

## 📁 Proposed Structure

```
inkwell-monorepo/                    # Parent repository
├── .git/
├── README.md
├── shared/                          # Shared code (submodule)
│   ├── functions/                   # Firebase Cloud Functions
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   ├── firebase.json
│   └── package.json
├── web/                             # Web app (submodule)
│   ├── public/
│   ├── package.json
│   └── firebase.json
└── mobile/                          # React Native app (submodule)
    ├── src/
    ├── ios/
    ├── android/
    └── package.json
```

---

## 🚀 Setup Steps

### **Step 1: Create GitHub Repositories**

You'll need **three** GitHub repositories:

1. **`inkwell-shared`** - Shared backend code (functions, rules)
2. **`inkwell-web`** - Web application
3. **`inkwell-monorepo`** - Parent repo that ties everything together

```bash
# On GitHub, create these repos:
# - yourusername/inkwell-shared
# - yourusername/inkwell-web  
# - yourusername/inkwell-monorepo
```

### **Step 2: Prepare Current Project**

Your current `inkwell/` folder will become `inkwell-web`:

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell

# Initialize git if not already done
git init
git add .
git commit -m "Initial commit - Web app baseline"

# Add GitHub remote (replace with your username)
git remote add origin https://github.com/yourusername/inkwell-web.git
git branch -M main
git push -u origin main
```

### **Step 3: Extract Shared Code**

```bash
# Create shared repository
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects
mkdir inkwell-shared
cd inkwell-shared

git init

# Copy shared files from web project
cp -r ../inkwell/functions ./
cp ../inkwell/firebase.json ./
cp ../inkwell/firestore.rules ./
cp ../inkwell/firestore.indexes.json ./
cp ../inkwell/package.json ./package.json

# Create README
cat > README.md << 'EOF'
# InkWell Shared Backend

Shared Firebase backend code for InkWell web and mobile apps.

## Contents
- Cloud Functions
- Firestore rules
- Firestore indexes
- Firebase configuration

## Usage
This repository is used as a Git submodule in both web and mobile projects.
EOF

git add .
git commit -m "Initial commit - Shared backend"
git remote add origin https://github.com/yourusername/inkwell-shared.git
git branch -M main
git push -u origin main
```

### **Step 4: Create Monorepo Structure**

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects
mkdir inkwell-monorepo
cd inkwell-monorepo

git init

# Add submodules
git submodule add https://github.com/yourusername/inkwell-shared.git shared
git submodule add https://github.com/yourusername/inkwell-web.git web

# Create monorepo README
cat > README.md << 'EOF'
# InkWell Monorepo

Unified development environment for InkWell web and mobile applications.

## Structure
- `shared/` - Firebase backend (functions, rules, config)
- `web/` - Web application
- `mobile/` - React Native mobile app (coming soon)

## Quick Start

### Clone with submodules
```bash
git clone --recurse-submodules https://github.com/yourusername/inkwell-monorepo.git
```

### Pull latest changes
```bash
git pull
git submodule update --remote --merge
```

### Update shared backend
```bash
cd shared
git pull origin main
cd ..
git add shared
git commit -m "Update shared backend"
git push
```

## Development Workflow

1. Make changes in appropriate submodule (`web/`, `mobile/`, or `shared/`)
2. Commit and push from within submodule directory
3. Update parent repo to track new submodule commit
4. Pull changes on other machines to stay in sync

EOF

git add .
git commit -m "Initial monorepo setup"
git remote add origin https://github.com/yourusername/inkwell-monorepo.git
git branch -M main
git push -u origin main
```

### **Step 5: Update Web Project to Use Shared**

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo/web

# Remove local copies of shared files
rm -rf functions
rm firebase.json
rm firestore.rules
rm firestore.indexes.json

# Create symlinks to shared directory
ln -s ../shared/functions ./functions
ln -s ../shared/firebase.json ./firebase.json
ln -s ../shared/firestore.rules ./firestore.rules
ln -s ../shared/firestore.indexes.json ./firestore.indexes.json

# Update .gitignore to ignore symlink targets but track symlinks
cat >> .gitignore << 'EOF'

# Shared files (symlinked from ../shared/)
functions/node_modules
EOF

git add .
git commit -m "Link to shared backend"
git push
```

### **Step 6: Create Mobile Project** (When Ready)

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo

# Create React Native app
npx react-native@latest init InkWellMobile
mv InkWellMobile mobile

cd mobile
git init
git add .
git commit -m "Initial React Native setup"
git remote add origin https://github.com/yourusername/inkwell-mobile.git
git push -u origin main

# Link to shared backend
ln -s ../shared/functions ./functions
ln -s ../shared/firebase.json ./firebase.json
ln -s ../shared/firestore.rules ./firestore.rules
ln -s ../shared/firestore.indexes.json ./firestore.indexes.json

git add .
git commit -m "Link to shared backend"
git push

# Add mobile to monorepo
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo
git submodule add https://github.com/yourusername/inkwell-mobile.git mobile
git add .
git commit -m "Add mobile submodule"
git push
```

---

## 🔄 Daily Workflow

### **Working on Web App**

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo/web

# Make changes to web-specific files
# ... edit files ...

# Commit and push
git add .
git commit -m "Update web UI"
git push

# Update monorepo to track change
cd ..
git add web
git commit -m "Update web submodule"
git push
```

### **Working on Shared Backend**

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo/shared

# Make changes to functions, rules, etc.
# ... edit files ...

# Commit and push
git add .
git commit -m "Add new cloud function"
git push

# Update monorepo
cd ..
git add shared
git commit -m "Update shared backend"
git push

# IMPORTANT: Pull shared changes in web and mobile
cd web
git pull
cd ../mobile
git pull
```

### **Syncing All Projects**

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo

# Pull latest from all submodules
git pull
git submodule update --remote --merge

# Or use this helper command:
git submodule foreach git pull origin main
```

---

## 🛠 Helper Scripts

### **sync-all.sh** - Pull all changes

```bash
#!/bin/bash
echo "🔄 Syncing InkWell monorepo..."

git pull
git submodule update --remote --merge

echo "✅ All projects synced!"
```

### **push-shared.sh** - Update shared and sync to all

```bash
#!/bin/bash
echo "📤 Pushing shared backend changes..."

cd shared
git add .
git commit -m "${1:-Update shared backend}"
git push

cd ..
git add shared
git commit -m "Update shared submodule reference"
git push

echo "✅ Shared backend updated across all projects!"
```

---

## 🚨 Important Notes

### **Firebase Project Connection**

Both web and mobile will use the **same Firebase project**:
- Same Cloud Functions
- Same Firestore database
- Same Authentication
- Same Storage bucket

### **Deployment**

```bash
# Deploy from shared directory
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo/shared
firebase deploy --only functions,firestore:rules

# Or deploy web app
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo/web
firebase deploy --only hosting
```

### **Environment Variables**

Keep `.env` files in each project but **shared functions** should use Firebase config:

```bash
# In shared/functions/
firebase functions:config:set anthropic.key="YOUR_KEY"
firebase functions:config:set twilio.account_sid="YOUR_SID"
```

---

## 📱 Benefits of This Structure

1. **Single Source of Truth** - Backend code in one place
2. **Automatic Sync** - GitHub keeps everything updated
3. **Independent Development** - Work on web or mobile separately
4. **Shared Updates** - Function changes apply to both apps
5. **Version Control** - Track changes across all projects
6. **Easy Onboarding** - Clone monorepo, get everything

---

## 🔧 Troubleshooting

### **Submodule not updating?**

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo
git submodule update --remote --force
```

### **Symlinks not working?**

```bash
# Check if symlinks exist
ls -la web/functions

# Recreate if needed
cd web
rm functions
ln -s ../shared/functions ./functions
```

### **Changes not appearing?**

Make sure you:
1. Committed in the submodule
2. Pushed from the submodule
3. Updated parent repo
4. Pulled on other machines

---

## 🎉 Next Steps

1. Run the automated setup script: `./setup-monorepo.sh`
2. Verify all three GitHub repos are created
3. Test making a change in `shared/` and see it in `web/`
4. Create mobile app when ready
5. Celebrate having a professional dev setup! 🚀

# InkWell Monorepo Quick Start

**Setup Status:** Ready to begin  
**Time Required:** 20-30 minutes  

---

## 🎯 What You're Setting Up

A unified development system where:
- **Web app** and **mobile app** share the same Firebase backend
- Changes to backend (Cloud Functions, Firestore rules) automatically apply to both
- Each app can be developed independently
- Everything syncs via GitHub

---

## 📋 Prerequisites

Before starting, you need:

1. ✅ GitHub account (create at https://github.com/signup)
2. ✅ Git installed on your Mac (check: `git --version`)
3. ✅ Firebase CLI installed (check: `firebase --version`)
4. ✅ Your current InkWell web app (~100% complete)

---

## 🚀 Step-by-Step Setup

### Step 1: Run the Setup Script (5 minutes)

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell
./setup-monorepo.sh
```

This script will:
- Create a backup of your current project
- Set up three directories: `inkwell-shared`, `inkwell-web`, `inkwell-monorepo`
- Initialize Git in each
- Prepare everything for GitHub

**✋ Stop here until Step 2 is complete**

---

### Step 2: Create GitHub Repositories (5 minutes)

Go to https://github.com/new and create **three** new repositories:

1. **inkwell-shared**
   - Description: "Shared Firebase backend for InkWell"
   - Private ✓
   - **Do NOT** initialize with README

2. **inkwell-web**
   - Description: "InkWell web application"
   - Private ✓
   - **Do NOT** initialize with README

3. **inkwell-monorepo**
   - Description: "InkWell unified development environment"
   - Private ✓
   - **Do NOT** initialize with README

**📝 Note your GitHub username for the next step**

---

### Step 3: Push to GitHub (5 minutes)

Replace `YOUR_GITHUB_USERNAME` with your actual username in these commands:

```bash
# Push shared backend
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-shared
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/inkwell-shared.git
git branch -M main
git push -u origin main

# Push web app
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/inkwell-web.git
git branch -M main
git push -u origin main

# Setup monorepo with submodules
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo
git submodule add https://github.com/YOUR_GITHUB_USERNAME/inkwell-shared.git shared
git submodule add https://github.com/YOUR_GITHUB_USERNAME/inkwell-web.git web
git add .
git commit -m "Add web and shared submodules"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/inkwell-monorepo.git
git branch -M main
git push -u origin main
```

---

### Step 4: Link Web to Shared Backend (5 minutes)

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo/web

# Remove local copies
rm -rf functions
rm firebase.json
rm firestore.rules
rm firestore.indexes.json

# Create symlinks to shared
ln -s ../shared/functions ./functions
ln -s ../shared/firebase.json ./firebase.json
ln -s ../shared/firestore.rules ./firestore.rules
ln -s ../shared/firestore.indexes.json ./firestore.indexes.json

# Commit and push
git add .
git commit -m "Link to shared backend"
git push

# Update parent repo
cd ..
git add web
git commit -m "Update web submodule to use shared backend"
git push
```

---

### Step 5: Verify Setup (2 minutes)

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo

# Check structure
ls -la
# Should see: shared/, web/, scripts/, README.md

# Verify submodules
git submodule status
# Should show commits for shared and web

# Test sync script
./scripts/sync-all.sh
```

If you see "✅ All projects synced successfully!" - **you're done!**

---

## ✅ What You've Accomplished

You now have:

1. **Three GitHub repositories** working together
2. **Monorepo structure** with shared backend
3. **Web app** linked to shared code
4. **Automated scripts** for syncing and deploying
5. **Foundation** for adding mobile app

---

## 🎯 Next Steps

### For Today: Test the Setup

```bash
# Make a small change to test
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo/web
echo "<!-- Test comment -->" >> public/index.html

git add public/index.html
git commit -m "Test commit"
git push

# Verify it's on GitHub
open https://github.com/YOUR_GITHUB_USERNAME/inkwell-web
```

---

### When Ready: Add Mobile App

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo

# Create React Native project
npx react-native@latest init InkWellMobile
mv InkWellMobile mobile

# Follow the detailed instructions in MONOREPO-SETUP-GUIDE.md
# Section: "Step 6: Create Mobile Project"
```

---

## 📚 Documentation Reference

- **Full Setup Guide:** [MONOREPO-SETUP-GUIDE.md](MONOREPO-SETUP-GUIDE.md)
- **Daily Workflow:** [DEVELOPMENT-WORKFLOW.md](DEVELOPMENT-WORKFLOW.md)
- **Migration Plan:** [REACT-NATIVE-MIGRATION-PLAN.md](REACT-NATIVE-MIGRATION-PLAN.md)

---

## 🆘 Need Help?

### Common Issues

**Issue: "Permission denied (publickey)" when pushing**
```bash
# Use HTTPS instead of SSH
git remote set-url origin https://github.com/YOUR_GITHUB_USERNAME/inkwell-shared.git
```

**Issue: "fatal: destination path 'shared' already exists"**
```bash
# Remove and re-add submodule
rm -rf shared
git submodule add https://github.com/YOUR_GITHUB_USERNAME/inkwell-shared.git shared
```

**Issue: Symlinks not working**
```bash
# Verify symlinks
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo/web
ls -la | grep "^l"
# Should see: functions, firebase.json, etc. pointing to ../shared/
```

---

## 🎉 You're Ready!

You can now:
- ✅ Work on your web app in `inkwell-monorepo/web/`
- ✅ Update backend in `inkwell-monorepo/shared/`
- ✅ Use scripts to sync and deploy
- ✅ Add mobile app when ready

All connected to the same Firebase project! 🚀

---

**Next:** Open [DEVELOPMENT-WORKFLOW.md](DEVELOPMENT-WORKFLOW.md) for daily usage patterns.

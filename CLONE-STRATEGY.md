# InkWell Clone Strategy for React Native Migration

**Date:** November 5, 2025  
**Current Commit:** `ca09b3b` (Clean baseline)  
**Strategy:** Maintain separate web app while building React Native version

---

## Overview

You'll maintain **two separate projects**:

1. **`inkwell/`** (Current) - Web app, stays live, continues receiving updates
2. **`inkwell-mobile/`** (New) - React Native app, built from web codebase

---

## Cloning Approach

### **Option A: Git Branch (Recommended)**

Keep both in the same repo with separate branches:

```bash
# Navigate to current project
cd /Users/Grimm/Documents/Pegasus\ Realm/15\ App\ Projects/inkwell

# Create new branch for React Native
git checkout -b react-native

# You're now on 'react-native' branch
# Main web app stays on 'main' branch
```

**Pros:**
- ✅ Single repo, easy to cherry-pick features
- ✅ Shared git history
- ✅ Can merge common fixes (backend) between branches

**Cons:**
- ⚠️ Must be careful switching branches
- ⚠️ Both projects in same directory (can't run simultaneously)

---

### **Option B: Separate Project Folder (Cleaner)**

Create completely separate React Native project:

```bash
# Navigate to projects directory
cd /Users/Grimm/Documents/Pegasus\ Realm/15\ App\ Projects

# Create new React Native project
npx react-native init InkWellMobile --template react-native-template-typescript

# Copy backend functions
cp -r inkwell/functions/ InkWellMobile/functions/
cp inkwell/firebase.json InkWellMobile/
cp inkwell/firestore.rules InkWellMobile/
cp inkwell/firestore.indexes.json InkWellMobile/
cp inkwell/.firebaserc InkWellMobile/

# Copy utility/logic files (to port)
mkdir InkWellMobile/web-reference
cp inkwell/public/auth.js InkWellMobile/web-reference/
cp inkwell/public/app.html InkWellMobile/web-reference/
cp inkwell/REACT-NATIVE-MIGRATION-PLAN.md InkWellMobile/
```

**Pros:**
- ✅ Complete separation (no branch confusion)
- ✅ Can run web app and work on mobile simultaneously
- ✅ Cleaner React Native initialization
- ✅ Independent git repos (can push mobile to new repo)

**Cons:**
- ⚠️ Duplicate Firebase backend code
- ⚠️ Must manually sync backend updates

---

### **Option C: Monorepo (Advanced)**

Use a single repo with workspace structure:

```
pegasus-inkwell/
├── packages/
│   ├── web/          # Current web app
│   ├── mobile/       # React Native app
│   └── functions/    # Shared backend
├── package.json      # Root workspace config
└── lerna.json        # Monorepo management
```

**Pros:**
- ✅ Best code sharing (single functions folder)
- ✅ Professional structure
- ✅ Easy cross-platform feature development

**Cons:**
- ⚠️ Complex setup
- ⚠️ Learning curve
- ⚠️ Overkill for solo developer

---

## Recommended Approach: **Option B (Separate Folder)**

**Why?** 
- Simplest for solo development
- No risk of breaking live web app
- Can work on both simultaneously
- React Native CLI expects clean directory structure

---

## Step-by-Step: Clone to Separate Folder

### **Step 1: Create React Native Project**

```bash
# Navigate to projects directory
cd /Users/Grimm/Documents/Pegasus\ Realm/15\ App\ Projects

# Initialize new React Native project with TypeScript
npx react-native init InkWellMobile --template react-native-template-typescript

# Wait 2-5 minutes for installation
```

---

### **Step 2: Copy Firebase Backend**

```bash
# Copy Firebase configuration files
cp inkwell/firebase.json InkWellMobile/
cp inkwell/.firebaserc InkWellMobile/
cp inkwell/firestore.rules InkWellMobile/
cp inkwell/firestore.indexes.json InkWellMobile/
cp inkwell/.gcloudignore InkWellMobile/

# Copy Cloud Functions (entire folder)
cp -r inkwell/functions/ InkWellMobile/functions/

# Install functions dependencies
cd InkWellMobile/functions
npm install
cd ..
```

**Result:** React Native project can now deploy to same Firebase backend

---

### **Step 3: Copy Reference Materials**

```bash
# Create reference folder for web code
mkdir InkWellMobile/web-reference

# Copy web app files for porting
cp inkwell/public/auth.js InkWellMobile/web-reference/
cp inkwell/public/app.html InkWellMobile/web-reference/
cp inkwell/public/config.js InkWellMobile/web-reference/

# Copy documentation
cp inkwell/REACT-NATIVE-MIGRATION-PLAN.md InkWellMobile/
cp inkwell/GRATITUDE-SMS-SYSTEM.md InkWellMobile/
cp inkwell/SMS-SETUP-GUIDE.md InkWellMobile/

# Copy package.json for reference (see what packages were used)
cp inkwell/package.json InkWellMobile/web-reference/web-package.json
```

---

### **Step 4: Set Up Git for Mobile Project**

```bash
cd InkWellMobile

# Initialize git
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# OSX
.DS_Store

# Node
node_modules/
npm-debug.log
yarn-error.log

# React Native
.expo/
.expo-shared/

# iOS
ios/build/
ios/Pods/
ios/*.xcworkspace
ios/*.xcuserstate

# Android
android/build/
android/app/build/
android/.gradle/

# Firebase
.firebase/
firebase-debug*.log

# Environment
.env
.env.local

# IDE
.vscode/
.idea/

# Web reference (optional - can keep uncommitted)
# web-reference/
EOF

# Initial commit
git add .
git commit -m "Initial commit: React Native project initialized from InkWell web"

# Create GitHub repo and push (optional)
# gh repo create PegasusRealm/inkwell-mobile --private --source=. --remote=origin --push
```

---

### **Step 5: Install React Native Firebase**

```bash
cd InkWellMobile

# Install core Firebase packages
npm install @react-native-firebase/app
npm install @react-native-firebase/auth
npm install @react-native-firebase/firestore
npm install @react-native-firebase/storage
npm install @react-native-firebase/functions
npm install @react-native-firebase/messaging

# Install CocoaPods for iOS
cd ios
pod install
cd ..
```

---

### **Step 6: Configure Firebase for iOS & Android**

#### **iOS Setup:**
```bash
# Download GoogleService-Info.plist from Firebase Console
# https://console.firebase.google.com/project/inkwell-alpha/settings/general/ios

# Move to: InkWellMobile/ios/InkWellMobile/GoogleService-Info.plist
```

#### **Android Setup:**
```bash
# Download google-services.json from Firebase Console
# https://console.firebase.google.com/project/inkwell-alpha/settings/general/android

# Move to: InkWellMobile/android/app/google-services.json

# Edit: android/build.gradle
# Add: classpath 'com.google.gms:google-services:4.4.0'

# Edit: android/app/build.gradle
# Add at bottom: apply plugin: 'com.google.gms.google-services'
```

---

### **Step 7: Test That Everything Works**

```bash
# Test iOS (requires Mac with Xcode)
npx react-native run-ios

# Test Android (requires Android Studio)
npx react-native run-android

# Test Firebase connection
# Add this to App.tsx temporarily:
import firestore from '@react-native-firebase/firestore';
console.log('Firebase connected:', firestore().app.name);
```

---

## What Gets Shared vs Separate

### **Shared (Same Firebase Project):**
- ✅ Cloud Functions (same backend)
- ✅ Firestore database (same data)
- ✅ Firebase Storage (same files)
- ✅ Firebase Auth (same users)
- ✅ Firebase Hosting (web app only)

### **Separate (Independent):**
- ❌ Frontend code (HTML vs React Native)
- ❌ UI/UX implementation
- ❌ Platform-specific features (camera, push notifications)
- ❌ App Store presence (web vs iOS/Android)
- ❌ Git repository (optional - can be same or different)

---

## Workflow After Clone

### **Working on Web App (inkwell/):**
```bash
cd /Users/Grimm/Documents/Pegasus\ Realm/15\ App\ Projects/inkwell

# Make changes to web app
# ... edit files ...

# Deploy web app
firebase deploy --only hosting

# Push changes
git add .
git commit -m "fix: Updated user settings modal"
git push origin main
```

---

### **Working on Mobile App (InkWellMobile/):**
```bash
cd /Users/Grimm/Documents/Pegasus\ Realm/15\ App\ Projects/InkWellMobile

# Make changes to mobile app
# ... edit React Native components ...

# Test on iOS simulator
npx react-native run-ios

# Test on Android emulator
npx react-native run-android

# Commit changes
git add .
git commit -m "feat: Implemented journal entry list screen"
git push origin main
```

---

### **Updating Shared Backend:**

When you update Cloud Functions that **both** apps use:

```bash
# Option 1: Edit in web project, copy to mobile
cd /Users/Grimm/Documents/Pegasus\ Realm/15\ App\ Projects/inkwell/functions
# ... edit index.js ...
cp index.js ../InkWellMobile/functions/

# Option 2: Edit in mobile project, copy to web
cd /Users/Grimm/Documents/Pegasus\ Realm/15\ App\ Projects/InkWellMobile/functions
# ... edit index.js ...
cp index.js ../inkwell/functions/

# Deploy from EITHER project (same Firebase project)
firebase deploy --only functions
```

**Tip:** Keep Cloud Functions in sync by always deploying from one "source of truth" project.

---

## Complete Clone Command Sequence

Here's the full sequence to copy-paste:

```bash
# STEP 1: Navigate to projects directory
cd /Users/Grimm/Documents/Pegasus\ Realm/15\ App\ Projects

# STEP 2: Create React Native project
npx react-native init InkWellMobile --template react-native-template-typescript

# STEP 3: Copy Firebase backend
cp inkwell/firebase.json InkWellMobile/
cp inkwell/.firebaserc InkWellMobile/
cp inkwell/firestore.rules InkWellMobile/
cp inkwell/firestore.indexes.json InkWellMobile/
cp inkwell/.gcloudignore InkWellMobile/
cp -r inkwell/functions/ InkWellMobile/functions/

# STEP 4: Create web reference folder
mkdir InkWellMobile/web-reference
cp inkwell/public/auth.js InkWellMobile/web-reference/
cp inkwell/public/app.html InkWellMobile/web-reference/
cp inkwell/public/config.js InkWellMobile/web-reference/
cp inkwell/package.json InkWellMobile/web-reference/web-package.json

# STEP 5: Copy documentation
cp inkwell/REACT-NATIVE-MIGRATION-PLAN.md InkWellMobile/
cp inkwell/GRATITUDE-SMS-SYSTEM.md InkWellMobile/
cp inkwell/SMS-SETUP-GUIDE.md InkWellMobile/

# STEP 6: Install functions dependencies
cd InkWellMobile/functions
npm install
cd ..

# STEP 7: Install React Native Firebase
npm install @react-native-firebase/app
npm install @react-native-firebase/auth
npm install @react-native-firebase/firestore
npm install @react-native-firebase/storage
npm install @react-native-firebase/functions
npm install @react-native-firebase/messaging

# STEP 8: Install iOS pods
cd ios
pod install
cd ..

# STEP 9: Initialize git
git init
git add .
git commit -m "Initial commit: React Native project initialized from InkWell web"

# DONE! Now configure Firebase iOS/Android credentials from console
echo "✅ InkWellMobile project created!"
echo "Next: Download GoogleService-Info.plist and google-services.json"
```

---

## Verification Checklist

After cloning, verify:

- [ ] `InkWellMobile/` folder exists at same level as `inkwell/`
- [ ] React Native project builds: `npx react-native run-ios` or `run-android`
- [ ] `InkWellMobile/functions/` contains all Cloud Functions
- [ ] `InkWellMobile/firebase.json` exists
- [ ] `InkWellMobile/web-reference/` contains web app files for porting
- [ ] `InkWellMobile/REACT-NATIVE-MIGRATION-PLAN.md` exists
- [ ] Original `inkwell/` folder unchanged (web app still works)
- [ ] Firebase credentials configured (GoogleService-Info.plist, google-services.json)

---

## Summary

**Approach:** Separate folder (`InkWellMobile/`) alongside original (`inkwell/`)

**Benefits:**
- ✅ Web app stays live and unchanged
- ✅ Can work on both simultaneously
- ✅ Clean React Native environment
- ✅ Independent git repos (optional)
- ✅ Shared Firebase backend (no data duplication)

**Next Steps:**
1. Run clone command sequence above
2. Configure Firebase credentials for iOS/Android
3. Test that React Native app builds
4. Start implementing Phase 1 from migration plan (auth screens)

Ready to clone! 🚀

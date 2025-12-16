# InkWell Development Workflow Guide

**Date:** December 16, 2025  
**Monorepo Structure:** Git submodules with shared backend  

---

## 📋 Quick Reference

### Daily Commands

```bash
# Sync all projects
cd inkwell-monorepo && ./scripts/sync-all.sh

# Work on web app
cd inkwell-monorepo/web
# make changes, then:
git add . && git commit -m "Your message" && git push

# Update shared backend
cd inkwell-monorepo/shared
# make changes, then:
cd .. && ./scripts/push-shared.sh "Your commit message"

# Deploy backend
cd inkwell-monorepo && ./scripts/deploy-backend.sh [all|functions|rules]
```

---

## 🎯 Common Workflows

### Workflow 1: Update Web UI Only

When making changes that only affect the web frontend:

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo/web

# Make your changes to HTML, CSS, or client-side JS
# For example: edit public/app.html

git add .
git commit -m "Update journal entry UI"
git push

# Update parent repo to track the change
cd ..
git add web
git commit -m "Update web submodule"
git push
```

**Result:** Only web app is affected. Mobile app unchanged.

---

### Workflow 2: Update Backend (Affects Both Apps)

When adding/modifying Cloud Functions, Firestore rules, or backend logic:

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo/shared

# Make your changes
# For example: edit functions/index.js to add new endpoint

git add .
git commit -m "Add new AI analysis endpoint"
git push

# Update parent repo
cd ..
git add shared
git commit -m "Update shared backend"
git push

# Deploy to Firebase
./scripts/deploy-backend.sh functions

# Pull changes in other projects
cd web && git pull && cd ..
cd mobile && git pull && cd ..  # when mobile exists
```

**Result:** Backend change deployed, affects both web and mobile apps.

---

### Workflow 3: Add New Feature (Using Branches)

For larger features, use feature branches:

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo

# Create feature branch in appropriate project
./scripts/new-feature.sh web export-journal

# Now in web/feature/export-journal branch
cd web

# Make your changes
# ... edit files ...

# Commit and push
git add .
git commit -m "Add journal export functionality"
git push -u origin feature/export-journal

# On GitHub, create Pull Request
# After review and merge, sync back
git checkout main
git pull
cd ..
git add web
git commit -m "Update web after feature merge"
git push
```

---

### Workflow 4: Start Fresh on Another Machine

Setting up the monorepo on a new computer:

```bash
# Clone with all submodules
git clone --recurse-submodules https://github.com/yourusername/inkwell-monorepo.git
cd inkwell-monorepo

# Verify everything is there
ls -la
# Should see: shared/, web/, mobile/ (if created)

# Install dependencies
cd shared/functions && npm install && cd ../..
cd web && npm install && cd ..

# You're ready to develop!
```

---

### Workflow 5: Sync Everything (Pull All Changes)

Every day before starting work, sync all projects:

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo
./scripts/sync-all.sh
```

This ensures you have:
- Latest parent repo changes
- Latest shared backend updates
- Latest web app updates
- Latest mobile app updates

---

## 🔧 Specific Development Tasks

### Task: Add New Cloud Function

```bash
cd inkwell-monorepo/shared

# Edit functions/index.js
# Add your new function...

# Test locally (optional)
cd functions && npm install && cd ..
firebase emulators:start

# Commit and deploy
git add functions/index.js
git commit -m "Add sendReminderNotification function"
git push

# Deploy
cd .. && ./scripts/deploy-backend.sh functions
```

---

### Task: Update Firestore Rules

```bash
cd inkwell-monorepo/shared

# Edit firestore.rules
# Add new security rules...

# Test locally
firebase emulators:start

# Commit and deploy
git add firestore.rules
git commit -m "Add coach access rules"
git push

# Deploy rules only (fast)
cd .. && ./scripts/deploy-backend.sh rules
```

---

### Task: Fix Bug in Web App

```bash
cd inkwell-monorepo/web

# Find and fix bug in public/app.html or public/auth.js
# ... make changes ...

# Test locally
firebase serve

# Commit
git add .
git commit -m "Fix login redirect bug"
git push

# Deploy web app
firebase deploy --only hosting
```

---

### Task: Create Mobile App (First Time)

```bash
cd /Users/Grimm/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo

# Create React Native project
npx react-native@latest init InkWellMobile
mv InkWellMobile mobile

# Initialize git
cd mobile
git init
git add .
git commit -m "Initial React Native setup"

# Push to GitHub (create repo first on GitHub)
git remote add origin https://github.com/yourusername/inkwell-mobile.git
git branch -M main
git push -u origin main

# Link to shared backend
ln -s ../shared/functions ./functions
ln -s ../shared/firebase.json ./firebase.json
ln -s ../shared/firestore.rules ./firestore.rules

git add .
git commit -m "Link to shared backend"
git push

# Add to monorepo
cd ..
git submodule add https://github.com/yourusername/inkwell-mobile.git mobile
git add .
git commit -m "Add mobile submodule"
git push
```

---

## 🚨 Troubleshooting Common Issues

### Issue: "Submodule not updating"

```bash
cd inkwell-monorepo
git submodule update --remote --force --recursive
```

---

### Issue: "Changes in shared/ not appearing in web/"

The symlinks might be broken. Recreate them:

```bash
cd inkwell-monorepo/web
rm -f functions firebase.json firestore.rules firestore.indexes.json

ln -s ../shared/functions ./functions
ln -s ../shared/firebase.json ./firebase.json
ln -s ../shared/firestore.rules ./firestore.rules
ln -s ../shared/firestore.indexes.json ./firestore.indexes.json

# Verify symlinks
ls -la

git add .
git commit -m "Fix shared backend symlinks"
git push
```

---

### Issue: "Can't deploy - Firebase not initialized"

```bash
cd inkwell-monorepo/shared
firebase use your-project-id
firebase deploy
```

---

### Issue: "Merge conflict in submodule"

```bash
cd inkwell-monorepo/web  # or whichever submodule
git status
# Resolve conflicts in files
git add .
git commit -m "Resolve merge conflict"
git push

cd ..
git add web
git commit -m "Update web after conflict resolution"
git push
```

---

## 📊 Project Status Checking

### Check Git Status Across All Projects

```bash
cd inkwell-monorepo

echo "=== Parent Repo ==="
git status

echo -e "\n=== Shared Backend ==="
cd shared && git status && cd ..

echo -e "\n=== Web App ==="
cd web && git status && cd ..

echo -e "\n=== Mobile App ==="
cd mobile && git status && cd ..  # when mobile exists
```

---

### Check Which Versions Are Deployed

```bash
cd inkwell-monorepo

echo "=== Submodule Commits ==="
git submodule status

echo -e "\n=== Current Branches ==="
cd shared && git branch && cd ..
cd web && git branch && cd ..
```

---

## 🎯 Best Practices

### ✅ Do's

1. **Always sync before starting work**
   ```bash
   ./scripts/sync-all.sh
   ```

2. **Commit small, commit often**
   - Don't let changes pile up
   - Clear commit messages

3. **Test before pushing**
   - Run locally first
   - Use Firebase emulators

4. **Update parent repo after submodule changes**
   ```bash
   git add web  # or shared, mobile
   git commit -m "Update submodule"
   git push
   ```

5. **Use feature branches for big changes**
   ```bash
   ./scripts/new-feature.sh web my-feature
   ```

---

### ❌ Don'ts

1. **Don't edit submodules outside monorepo**
   - Always work inside `inkwell-monorepo/`

2. **Don't commit directly to main for big features**
   - Use feature branches
   - Create Pull Requests

3. **Don't forget to update parent after submodule push**
   - Parent repo needs to track submodule commits

4. **Don't deploy without committing**
   - Always commit changes first
   - Then deploy

5. **Don't mix web and backend changes in one commit**
   - Keep them separate
   - Makes rollbacks easier

---

## 📅 Daily Developer Checklist

### Morning Routine

- [ ] `cd inkwell-monorepo`
- [ ] `./scripts/sync-all.sh`
- [ ] Check Git status in each project
- [ ] Plan today's work (web, mobile, or shared?)

### During Development

- [ ] Work in appropriate submodule directory
- [ ] Test changes locally
- [ ] Commit frequently with clear messages
- [ ] Push to remote

### Before Deploying

- [ ] Commit all changes
- [ ] Run local tests/emulators
- [ ] Deploy using scripts: `./scripts/deploy-backend.sh`
- [ ] Verify deployment

### End of Day

- [ ] Push all uncommitted work
- [ ] Update parent repo with submodule changes
- [ ] Document any blockers or todos

---

## 🔗 Quick Links

- **Main Repo:** https://github.com/yourusername/inkwell-monorepo
- **Shared Backend:** https://github.com/yourusername/inkwell-shared
- **Web App:** https://github.com/yourusername/inkwell-web
- **Mobile App:** https://github.com/yourusername/inkwell-mobile

---

## 🎓 Learning Resources

### Git Submodules
- [Official Git Docs](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- [Atlassian Submodules Guide](https://www.atlassian.com/git/tutorials/git-submodule)

### Firebase
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Cloud Functions Docs](https://firebase.google.com/docs/functions)

### React Native
- [Official Docs](https://reactnative.dev/)
- [Firebase + React Native](https://rnfirebase.io/)

---

## 💡 Pro Tips

1. **Create aliases for common commands**
   ```bash
   # Add to ~/.zshrc
   alias iw-sync="cd ~/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo && ./scripts/sync-all.sh"
   alias iw-deploy="cd ~/Documents/Pegasus_Realm/15_App_Projects/inkwell-monorepo && ./scripts/deploy-backend.sh"
   ```

2. **Use VS Code Multi-root workspace**
   - Open `inkwell-monorepo/` as workspace
   - See all projects in sidebar
   - Search across all projects

3. **Set up Git hooks**
   - Auto-format code before commit
   - Run tests before push
   - Validate commit messages

4. **Keep a changelog**
   - Document major changes
   - Track version numbers
   - Note breaking changes

---

## 🚀 You're All Set!

This workflow ensures:
- ✅ Single source of truth for backend
- ✅ Independent development of web and mobile
- ✅ Easy synchronization across projects
- ✅ Professional development practices
- ✅ Scalable for team collaboration

Happy coding! 🎉

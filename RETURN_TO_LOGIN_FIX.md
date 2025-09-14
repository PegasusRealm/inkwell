# Return to Login Button Fix

## Issue
The "Return to Login" button on the goodbye modal was leading to a blank page instead of showing the login modal.

## Root Cause
The button handler in `auth.js` was only hiding the `main` element but not the `mainUI` container, which caused content to remain visible and interfere with the login modal display.

## Original Problematic Code
```javascript
returnToLoginBtn.onclick = function () {
  const goodbye = document.getElementById("goodbyeModal");
  const login = document.getElementById("loginModal");
  const main = document.querySelector("main");
  
  // Only hiding main, not mainUI container
  if (goodbye) goodbye.style.display = "none";
  if (main) main.style.display = "none";
  
  // Show login modal
  if (login) {
    login.style.display = "flex";
    // ... rest of styling
  }
};
```

## Fixed Implementation
```javascript
returnToLoginBtn.onclick = function () {
  // Use the existing showLoginModal function which handles everything properly
  if (window.showLoginModal) {
    window.showLoginModal();
  } else {
    // Fallback with proper mainUI handling
    const goodbye = document.getElementById("goodbyeModal");
    const login = document.getElementById("loginModal");
    const main = document.querySelector("main");
    const mainUI = document.getElementById("mainUI");
    
    // Hide goodbye modal and ALL main content
    if (goodbye) goodbye.style.display = "none";
    if (main) main.style.display = "none";
    if (mainUI) {
      mainUI.style.visibility = "hidden";
      mainUI.style.opacity = "0";
    }
    
    // Show login modal with proper styling
    if (login) {
      login.style.display = "flex";
      login.style.alignItems = "center";
      login.style.justifyContent = "center";
      login.style.backgroundColor = "rgba(21,54,58,0.88)";
    }
    
    // Reset login fields
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
  }
};
```

## Key Changes
1. **Primary Fix**: Uses existing `window.showLoginModal()` function which handles all modal transitions properly
2. **Fallback Safety**: Added fallback code that includes `mainUI` container handling
3. **Complete Content Hiding**: Ensures both `main` and `mainUI` elements are properly hidden
4. **Field Reset**: Clears login form fields for fresh login attempt

## Expected Behavior
- User clicks "Return to Login" on goodbye modal
- Goodbye modal closes
- All main content is hidden 
- Login modal appears with backdrop
- Login form fields are cleared and ready for input

## Benefits
- Leverages existing, tested `showLoginModal` function
- Provides robust fallback for edge cases
- Ensures clean transition between modals
- Maintains consistent login modal styling

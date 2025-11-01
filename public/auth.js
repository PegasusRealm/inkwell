console.log("🔥 auth.js loaded ✅");
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  connectAuthEmulator,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  collection,
  query,
  getDocs,
  where,
  deleteDoc,
  updateDoc,
  orderBy,
  onSnapshot,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

import {
  getStorage,
  ref,
  deleteObject,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";





// ✅ Unified config block
const CONFIG = {
  firebase: window.firebaseConfig || {
    apiKey: "AIzaSyDivYKnp_SinGjL7iVVwSyQH-RnFHMFDM0",
    authDomain: "inkwell-alpha.firebaseapp.com",
    projectId: "inkwell-alpha",
    storageBucket: "inkwell-alpha.appspot.com"
  },
  calendar: {
    DAYS_OF_WEEK: ["S", "M", "T", "W", "T", "F", "S"]
  }
};

let currentUserId = null; // 🔄 Global holder for logged-in user ID

// Robust Firestore operation wrapper with retry logic
async function safeFirestoreOperation(operation, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`🔄 Firestore operation attempt ${i + 1} failed:`, error.message);
      
      // Don't retry on permission errors or invalid arguments
      if (error.code === 'permission-denied' || error.code === 'invalid-argument') {
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (i === retries - 1) {
        console.error('❌ All Firestore retry attempts failed:', error);
        throw new Error(`Connection failed after ${retries} attempts. Please check your internet connection and try again.`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

// Enhanced Firestore helpers with error handling and fallbacks
window.safeFirestoreOperation = safeFirestoreOperation;

// Fallback system for unreliable connections
let firestoreReliabilityScore = 100; // Start optimistic
const MIN_RELIABILITY_SCORE = 30;

function adjustReliabilityScore(success) {
  if (success) {
    firestoreReliabilityScore = Math.min(100, firestoreReliabilityScore + 5);
  } else {
    firestoreReliabilityScore = Math.max(0, firestoreReliabilityScore - 15);
  }
  
  if (firestoreReliabilityScore < MIN_RELIABILITY_SCORE) {
    console.warn(`🔄 Firestore reliability low (${firestoreReliabilityScore}/100) - using local fallbacks`);
  }
}

// Smart operation that prefers local storage when Firestore is unreliable
async function smartFirestoreOperation(operation, localFallback = null) {
  // If reliability is very low and we have a fallback, use it
  if (firestoreReliabilityScore < MIN_RELIABILITY_SCORE && localFallback) {
    console.log('📱 Using local fallback due to poor connection reliability');
    return localFallback();
  }
  
  try {
    const result = await safeFirestoreOperation(operation, 2, 500); // Reduced retries
    adjustReliabilityScore(true);
    return result;
  } catch (error) {
    adjustReliabilityScore(false);
    
    if (localFallback) {
      console.log('📱 Firestore failed, falling back to local storage');
      return localFallback();
    }
    
    throw error;
  }
}

window.smartFirestoreOperation = smartFirestoreOperation;

// Toast notification function
function showToast(message, type = "info", duration = 4000) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  
  // Style the toast
  toast.style.position = "fixed";
  toast.style.top = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.padding = "1em 1.5em";
  toast.style.borderRadius = "8px";
  toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  toast.style.zIndex = "9999";
  toast.style.fontWeight = "500";
  toast.style.maxWidth = "400px";
  toast.style.textAlign = "center";
  toast.style.border = "1px solid rgba(255,255,255,0.2)";
  toast.style.animation = "toastSlideIn 0.3s ease-out";
  
  // Set color based on type using app theme colors
  switch (type) {
    case "error":
      toast.style.backgroundColor = "#d9534f";
      toast.style.color = "#fff";
      toast.style.borderColor = "#c9302c";
      break;
    case "success":
      // Use app's brand colors instead of bright green
      toast.style.backgroundColor = "var(--brand-secondary, #388b97)";
      toast.style.color = "#fff";
      toast.style.borderColor = "var(--brand-primary, #2A6972)";
      break;
    case "warning":
      toast.style.backgroundColor = "var(--accent, #d49489)";
      toast.style.color = "#fff";
      toast.style.borderColor = "var(--accent-dark, #72332)";
      break;
    default:
      toast.style.backgroundColor = "var(--accent, #d49489)";
      toast.style.color = "#fff";
      toast.style.borderColor = "var(--accent-dark, #72332)";
  }
  
  // Add to page
  document.body.appendChild(toast);
  
  // Remove after duration
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, duration);
}

// Theme Management System
function initThemeSystem() {
  const themeSelect = document.getElementById('themeModeSelect');
  const settingsThemeSelect = document.getElementById('settingsThemeSelect');
  
  // Make applyTheme globally available
  window.applyTheme = function(mode) {
    if (mode === 'default') {
      // Use system preference but apply current themes (not old @media ones)
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        // Apply current complete dark theme
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        // Use default light theme
        document.documentElement.removeAttribute('data-theme');
      }
    } else {
      // Apply specific theme
      document.documentElement.setAttribute('data-theme', mode);
    }
  };

  // Load and apply saved theme
  const savedTheme = localStorage.getItem('inkwell-theme-mode') || 'default';
  if (themeSelect) themeSelect.value = savedTheme;
  if (settingsThemeSelect) settingsThemeSelect.value = savedTheme;
  
  // Apply theme immediately and also after a small delay to ensure CSS is loaded
  window.applyTheme(savedTheme);
  setTimeout(() => window.applyTheme(savedTheme), 100);

  // Handle theme changes from main selector
  if (themeSelect) {
    themeSelect.addEventListener('change', function() {
      const newTheme = this.value;
      localStorage.setItem('inkwell-theme-mode', newTheme);
      window.applyTheme(newTheme);
      // Sync with settings modal
      if (settingsThemeSelect) settingsThemeSelect.value = newTheme;
      // Refresh past entries to apply theme
      if (typeof window.loadPastEntries === "function") {
        setTimeout(() => window.loadPastEntries(), 100);
      }
      // Force refresh placeholder styles
      setTimeout(refreshPlaceholderStyles, 100);
    });
  }

  // Handle theme changes from settings modal selector
  if (settingsThemeSelect) {
    settingsThemeSelect.addEventListener('change', function() {
      const newTheme = this.value;
      localStorage.setItem('inkwell-theme-mode', newTheme);
      window.applyTheme(newTheme);
      // Sync with main selector
      if (themeSelect) themeSelect.value = newTheme;
      // Refresh past entries to apply theme
      if (typeof window.loadPastEntries === "function") {
        setTimeout(() => window.loadPastEntries(), 100);
      }
      // Force refresh placeholder styles
      setTimeout(refreshPlaceholderStyles, 100);
    });
  }

  // Handle system theme changes
  const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemDarkQuery.addListener(() => {
    const currentTheme = localStorage.getItem('inkwell-theme-mode') || 'default';
    if (currentTheme === 'default') {
      // Re-apply system default to use current theme logic
      window.applyTheme('default');
    }
  });
}

// Export initThemeSystem to global scope for index.html
window.initThemeSystem = initThemeSystem;

// Network status monitoring and connection quality detection
let isOnline = navigator.onLine;
let connectionRetries = 0;
let connectionQuality = 'unknown';
const MAX_CONNECTION_RETRIES = 3;

// Detect connection quality using app's own resources (avoids CORS)
async function detectConnectionQuality() {
  try {
    const start = Date.now();
    // Test connectivity using our own app resources to avoid CORS issues
    const response = await fetch('./config.js?' + Math.random(), { 
      method: 'HEAD',
      cache: 'no-cache',
      signal: AbortSignal.timeout(5000)
    });
    const latency = Date.now() - start;
    
    if (response.ok) {
      if (latency < 200) {
        connectionQuality = 'good';
      } else if (latency < 1000) {
        connectionQuality = 'fair';
      } else {
        connectionQuality = 'poor';
      }
      
      console.log(`📡 Connection quality: ${connectionQuality} (${latency}ms)`);
      
      // For poor connections, we might want to adjust Firestore behavior
      if (connectionQuality === 'poor' && window.db) {
        console.log("🐌 Poor connection detected - optimizing for reliability");
      }
    }
  } catch (error) {
    connectionQuality = 'blocked';
    console.warn("🚫 Connection test failed - likely blocked by network/ad blocker");
    
    // Note: Removed premature connection warning toast - app functions fine with limited connectivity
  }
}

// Run connection quality check
setTimeout(detectConnectionQuality, 1000);

// Monitor network status
window.addEventListener('online', () => {
  isOnline = true;
  connectionRetries = 0;
  console.log('🌐 Network connection restored');
  showToast('Connection restored', 'success', 2000);
});

window.addEventListener('offline', () => {
  isOnline = false;
  console.log('📶 Network connection lost');
  showToast('Connection lost. Some features may not work.', 'warning', 3000);
});

// Enhanced error handler for Firebase operations
function handleFirebaseError(error, operation = 'operation') {
  console.error(`Firebase ${operation} error:`, error);
  
  let userMessage = `Something went wrong with ${operation}. `;
  
  switch (error.code) {
    case 'permission-denied':
      userMessage = 'You don\'t have permission to perform this action.';
      break;
    case 'unavailable':
    case 'deadline-exceeded':
      userMessage = 'Service temporarily unavailable. Please try again in a moment.';
      break;
    case 'failed-precondition':
      userMessage = 'Please check your internet connection and try again.';
      break;
    case 'unauthenticated':
      userMessage = 'Please sign in and try again.';
      break;
    default:
      if (!isOnline) {
        userMessage = 'No internet connection. Please check your connection and try again.';
      } else if (error.message.includes('Failed to fetch') || error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
        userMessage = 'Connection blocked. Please disable ad blockers or try a different browser.';
      } else {
        userMessage += 'Please try again or contact support if this continues.';
      }
  }
  
  showToast(userMessage, 'error', 5000);
  return userMessage;
}

// Error suppression for known connection issues
const suppressedErrors = new Set();
const ERROR_SUPPRESSION_TIME = 30000; // 30 seconds

function shouldSuppressError(error) {
  const errorKey = `${error.code || 'unknown'}-${error.message?.substring(0, 50) || 'no-message'}`;
  const now = Date.now();
  
  // Check if we've seen this error recently
  if (suppressedErrors.has(errorKey)) {
    return true;
  }
  
  // Add to suppression list
  suppressedErrors.add(errorKey);
  
  // Remove from suppression list after timeout
  setTimeout(() => {
    suppressedErrors.delete(errorKey);
  }, ERROR_SUPPRESSION_TIME);
  
  return false;
}

// Global error handler with smart suppression
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.code) {
    // Suppress repetitive connection errors
    if (shouldSuppressError(event.reason)) {
      event.preventDefault();
      return;
    }
    
    // Handle specific error types
    const errorCode = event.reason.code;
    if (errorCode === 'unavailable' || 
        errorCode === 'deadline-exceeded' || 
        event.reason.message?.includes('ERR_BLOCKED_BY_CLIENT') ||
        event.reason.message?.includes('webchannel_connection')) {
      
      console.warn('🌐 Connection issue (suppressing future similar errors for 30s):', errorCode);
      event.preventDefault();
      return;
    }
    
    console.error('Unhandled Firebase error:', event.reason);
    handleFirebaseError(event.reason);
    event.preventDefault();
  }
});

// Console error suppression for known network issues
const originalConsoleError = console.error;
console.error = function(...args) {
  const message = args.join(' ');
  
  // Suppress common connection error spam
  if (message.includes('ERR_BLOCKED_BY_CLIENT') ||
      message.includes('webchannel_connection') ||
      message.includes('stream_bridge') ||
      message.includes('persistent_stream') ||
      message.includes('Failed to fetch')) {
    return; // Silently suppress
  }
  
  // Log other errors normally
  originalConsoleError.apply(console, args);
};

// Export error handler globally
window.handleFirebaseError = handleFirebaseError;

document.addEventListener("DOMContentLoaded", () => {
// Initialize theme system
initThemeSystem();

// Initialize Firebase with error handling
let app, auth, db, functions;

try {
  app = initializeApp(CONFIG.firebase);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  
  // Configure Firestore settings for better reliability and connection handling
  try {
    // Force long polling to avoid WebSocket issues
    if (typeof db._delegate?.settings === 'function') {
      db._delegate.settings({
        ignoreUndefinedProperties: true,
        merge: true,
        experimentalForceLongPolling: true, // Bypass WebSocket issues
        useFetchStreams: false // Disable fetch streams that can be blocked
      });
    }
    
    // Alternative approach for newer Firebase versions
    if (typeof db.settings === 'function') {
      db.settings({
        ignoreUndefinedProperties: true,
        merge: true
      });
    }
    
    console.log("🔧 Firestore configured with connection optimizations");
  } catch (settingsError) {
    console.warn("⚠️ Could not apply Firestore settings:", settingsError.message);
  }
  
  // Enable offline persistence to reduce connection requirements
  try {
    if (typeof enableNetwork !== 'undefined' && typeof disableNetwork !== 'undefined') {
      // Enable offline support
      console.log("🔄 Enabling Firestore offline support...");
      // Note: Persistence should be enabled before any Firestore operations
    }
  } catch (persistenceError) {
    console.warn("⚠️ Offline persistence not available:", persistenceError.message);
  }
  
  console.log("✅ Firebase initialized successfully");
} catch (error) {
  console.error("❌ Firebase initialization failed:", error);
  
  // Fallback error handling
  document.addEventListener('DOMContentLoaded', () => {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="position: fixed; top: 20px; left: 20px; right: 20px; z-index: 10000; background: #f8d7da; color: #721c24; padding: 15px; border: 1px solid #f5c6cb; border-radius: 8px;">
        <strong>Connection Error:</strong> Unable to connect to InkWell services. Please refresh the page or try again later.
        <button onclick="location.reload()" style="float: right; background: #721c24; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Refresh</button>
      </div>
    `;
    document.body.appendChild(errorDiv);
  });
}

// Expose Firebase services globally
window.app = app;
window.auth = auth;
window.db = db;
window.functions = functions;
window.httpsCallable = httpsCallable;
window.getDoc = getDoc;
window.doc = doc;
window.setDoc = setDoc;
window.addDoc = addDoc;
window.collection = collection;
window.query = query;
window.where = where;
window.getDocs = getDocs;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.orderBy = orderBy;
window.serverTimestamp = serverTimestamp;
window.signOut = signOut;
window.onSnapshot = onSnapshot;

// Create a Firebase-like global object for compatibility
window.firebase = {
  functions: () => ({
    httpsCallable: (name) => httpsCallable(functions, name)
  })
};
window.updateProfile = updateProfile;
window.deleteField = deleteField;
window.httpsCallable = httpsCallable;
window.updatePassword = updatePassword;
window.reauthenticateWithCredential = reauthenticateWithCredential;
window.EmailAuthProvider = EmailAuthProvider;

// Export storage functions
const storage = getStorage(app);
window.storage = storage;
window.ref = ref;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;

// Export utility functions
window.showToast = showToast;

// Define global showTab function
window.showTab = function(tabId) {
  const tabs = ["journalTab", "manifestTab", "calendarTab"];
  const buttons = {
    journalTab: document.getElementById("journalTabButton"),
    manifestTab: document.getElementById("manifestTabButton"),
    calendarTab: document.getElementById("calendarTabButton")
  };
  tabs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === tabId ? "block" : "none");
  });
  Object.values(buttons).forEach(btn => btn && btn.classList.remove("active"));
  if (buttons[tabId]) buttons[tabId].classList.add("active");
};

// Consolidated auth state change listener - handles all authentication state changes
onAuthStateChanged(auth, async (user) => {
  console.log("🔄 Auth state changed:", user ? `User: ${user.email}` : "User logged out");
  
  const statusDiv = document.getElementById("userStatus");
  const logoHero = document.querySelector('.logo-hero-inner');
  const baseUrl = window.location.origin;
  const inkwellLogoPath = `${baseUrl}/InkWell-Logo.png`;
  const backupLogoPath = `${baseUrl}/LOGO_SQ_Lg_Border_2024.png`;
  const mainUI = document.getElementById("mainUI");
  const mainApp = document.getElementById("mainAppContainer");
  const colorModeToggle = document.getElementById("colorModeToggle");
  const aboutBtn = document.getElementById("aboutInkwellBtn");
  const header = document.querySelector("header");
  const goodbyeModal = document.getElementById("goodbyeModal");
  const loginModal = document.getElementById("loginModal");
  const signupModal = document.getElementById("signupModal");

  // Always clear goodbye modal on any state change to prevent ghost state
  if (goodbyeModal) goodbyeModal.style.display = "none";

  // Clear any existing animation interval
  if (logoHero?.dataset.intervalId) {
    clearInterval(Number(logoHero.dataset.intervalId));
    delete logoHero.dataset.intervalId;
  }

  function toggleMainUI(show) {
    if (mainApp) mainApp.style.display = show ? "block" : "none";
    if (mainUI) {
      mainUI.style.display = show ? "block" : "none";
      mainUI.style.visibility = show ? "visible" : "hidden";
      mainUI.style.opacity = show ? "1" : "0";
    }
    if (colorModeToggle) colorModeToggle.style.display = show ? "block" : "none";
    if (aboutBtn) aboutBtn.style.display = show ? "block" : "none";
    if (header) header.style.display = show ? "block" : "none";
  }

  // Reset UI for logged out state
  if (!user || user.isAnonymous) {
    currentUserId = null;
    window.currentUserId = null;
    
    if (statusDiv) statusDiv.textContent = "";
    if (logoHero) {
      logoHero.innerHTML = '';
      const defaultLogo = document.createElement('img');
      defaultLogo.src = inkwellLogoPath;
      defaultLogo.alt = "InkWell Logo";
      defaultLogo.className = 'logo-img';
      logoHero.appendChild(defaultLogo);
    }
    
    // Handle logout state
    const justLoggedOut = localStorage.getItem("userJustLoggedOut") === "true";
    if (justLoggedOut && goodbyeModal) {
      goodbyeModal.style.display = "flex";
      localStorage.removeItem("userJustLoggedOut");
    } else if (loginModal && !document.body.classList.contains("fast-login-active")) {
      loginModal.style.display = "flex";
      setTimeout(() => {
        loginModal.scrollTop = 0;
        window.scrollTo(0, 0);
      }, 50);
    }

    if (signupModal) signupModal.style.display = "none";
    toggleMainUI(false);
    localStorage.removeItem("userAvatar");
    
    // Clear inactivity timers
    if (typeof clearTimeout !== 'undefined') {
      if (typeof window.inactivityTimeout !== 'undefined') clearTimeout(window.inactivityTimeout);
      if (typeof window.warningTimeout !== 'undefined') clearTimeout(window.warningTimeout);
      if (typeof clearInternalWarning === 'function') clearInternalWarning();
    }
    
    console.log("🔐 User not authenticated or anonymous");
    return;
  }

  try {
    // Update global user ID
    currentUserId = user.uid;
    window.currentUserId = currentUserId;

    // Clear logout state
    localStorage.removeItem("userJustLoggedOut");
    document.body.classList.remove("fast-login-active");
    if (loginModal) loginModal.style.display = "none";
    if (signupModal) signupModal.style.display = "none";

    // Show UI immediately
    toggleMainUI(true);
    window.scrollTo({ top: 0, behavior: "instant" });
    
    // Force main UI visibility for new users
    setTimeout(() => {
      const main = document.querySelector("main");
      if (main) main.style.display = "block";
      const tabButtons = document.getElementById("tabButtons");
      if (tabButtons) tabButtons.style.display = "flex";
      const journalTab = document.getElementById("journalTab");
      if (journalTab) journalTab.style.display = "block";
    }, 50);

    // Fetch user document
    const userDocRef = doc(db, "users", currentUserId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.error("User document not found");
      return;
    }
    
    const userData = userDoc.data();
    
    // 🔄 MIGRATION: Ensure existing users have default insight preferences
    if (!userData.insightsPreferences) {
      console.log("🔄 Migrating user to include default insight preferences");
      try {
        await setDoc(userDocRef, {
          insightsPreferences: {
            weeklyEnabled: true,
            monthlyEnabled: true,
            createdAt: serverTimestamp(),
            migratedAt: serverTimestamp()
          }
        }, { merge: true });
        console.log("✅ Successfully migrated user with default insight preferences");
      } catch (error) {
        console.error("❌ Failed to migrate user insight preferences:", error);
      }
    }
    
    // Update user status text
    if (statusDiv) {
      statusDiv.textContent = userData?.displayName
        ? `Journaling as: ${userData.displayName}`
        : user.email
          ? `Journaling as: ${user.email}`
          : "Journaling anonymously";
    }

    // Handle hero logo/avatar switching
    if (logoHero) {
      logoHero.innerHTML = '';
      
      const heroLogo = document.createElement('img');
      const heroAvatar = document.createElement('img');
      
      heroLogo.className = 'logo-img show';
      heroLogo.src = inkwellLogoPath;
      heroLogo.alt = "InkWell Logo";
      heroLogo.style.opacity = "1";
      
      heroAvatar.className = 'avatar-img';
      heroAvatar.alt = userData?.avatar ? "User Avatar" : "Pegasus Realm Placeholder";
      heroAvatar.style.opacity = "0";
      
      logoHero.appendChild(heroLogo);
      logoHero.appendChild(heroAvatar);
      
      if (userData?.avatar) {
        const preloadAvatar = new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            heroAvatar.src = userData.avatar;
            resolve();
          };
          img.onerror = () => {
            heroAvatar.src = backupLogoPath;
            resolve();
          };
          img.src = userData.avatar;
        });
        
        preloadAvatar.then(() => {
          const switchImages = () => {
            const isShowingLogo = heroLogo.style.opacity === "1";
            heroLogo.style.opacity = isShowingLogo ? "0" : "1";
            heroAvatar.style.opacity = isShowingLogo ? "1" : "0";
          };
          const intervalId = setInterval(switchImages, 30000);
          logoHero.dataset.intervalId = intervalId.toString();
        });
      } else {
        heroAvatar.src = backupLogoPath;
        const switchImages = () => {
          const isShowingLogo = heroLogo.style.opacity === "1";
          heroLogo.style.opacity = isShowingLogo ? "0" : "1";
          heroAvatar.style.opacity = isShowingLogo ? "1" : "0";
        };
        const intervalId = setInterval(switchImages, 30000);
        logoHero.dataset.intervalId = intervalId.toString();
      }
    }

    // Handle agreement check
    const agreed = userData.agreementAccepted === true;
    const localAccepted = localStorage.getItem("alphaAgreementAccepted") === "true";
    
    if (!agreed && !localAccepted) {
      const agreementNotice = document.getElementById("embeddedAgreementNotice");
      if (agreementNotice) agreementNotice.style.display = "block";
      
      const elementsToHide = [
        document.getElementById("journalTab"),
        document.getElementById("tabButtons"),
        document.querySelector("main")
      ];
      elementsToHide.forEach(el => {
        if (el) el.style.display = "none";
      });
    } else {
      const agreementNotice = document.getElementById("embeddedAgreementNotice");
      if (agreementNotice) agreementNotice.style.display = "none";
      
      // Run heavy initialization after first paint
      setTimeout(() => {
        try {
          if (typeof window.buildCalendar === 'function') {
            window.buildCalendar();
          } else if (typeof buildCalendar === 'function') {
            buildCalendar();
          }
          if (typeof checkForCoachReplies === 'function') checkForCoachReplies();
          if (typeof resetInactivityTimers === 'function') resetInactivityTimers();
          
          // Load manifest data
          if (typeof window.loadManifestData === 'function') {
            console.log("📋 Loading manifest data after login...");
            const manifestLoaded = window.loadManifestData();
            
            // Always restore timeline settings regardless of manifest data
            const timelineKey = `wishTimeline_${currentUserId}`;
            const savedDays = localStorage.getItem(timelineKey);
            const timelineSelect = document.getElementById("wishTimelineSelect");
            
            if (savedDays && timelineSelect) {
              console.log(`🎯 Restoring saved timeline: ${savedDays} days`);
              timelineSelect.value = savedDays;
            }
            
            // Update timeline and progress with proper timing
            setTimeout(() => {
              if (typeof window.updateWishTimeline === 'function') {
                window.updateWishTimeline();
              }
              
              // Ensure progress bar is properly updated after manifest load
              setTimeout(() => {
                if (typeof window.updateWishProgress === 'function') {
                  console.log("🔄 Updating progress bar after login...");
                  window.updateWishProgress();
                }
              }, 100);
            }, 200);
          }
          
          // Check if user should see What's New notification badge
          if (typeof window.checkWhatsNewBadge === 'function') {
            setTimeout(() => {
              window.checkWhatsNewBadge();
            }, 1000);
          }
        } catch (initError) {
          console.error("Error during post-auth initialization:", initError);
        }
      }, 150);
    }

    // Start inactivity timers for logged in users
    if (typeof resetInactivityTimers === 'function') {
      resetInactivityTimers();
    }

    // Set up logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        if (typeof safeLogout === 'function') safeLogout("manual");
      };
    }

    console.log("✅ User authentication and UI setup complete");

  } catch (error) {
    console.error("Error in auth state change handler:", error);
  }
});

// Function to check for new coach replies and show notifications
async function checkForCoachReplies() {
  if (!currentUserId) {
    console.log("🚫 No currentUserId available for coach reply check");
    return;
  }
  
  try {
    console.log("🔍 Checking for new coach replies for user:", currentUserId);
    
    // Query for entries with new coach replies
    const entriesRef = collection(db, "journalEntries");
    const coachReplyQuery = query(
      entriesRef,
      where("userId", "==", currentUserId),
      where("newCoachReply", "==", true)
    );
    
    const querySnapshot = await getDocs(coachReplyQuery);
    const newReplies = [];
    
    console.log("📊 Query snapshot size:", querySnapshot.size);
    
    querySnapshot.forEach((doc) => {
      const entryData = doc.data();
      console.log("📝 Found entry with new coach reply:", doc.id, entryData);
      newReplies.push({
        id: doc.id,
        date: entryData.createdAt?.toDate?.() || new Date(), // Use createdAt instead of date
        entry: entryData.text || entryData.entry, // Use text field from the database
        coachReplies: entryData.coachReplies || []
      });
    });
    
    console.log(`📬 Found ${newReplies.length} entries with new coach replies`);
    
    if (newReplies.length > 0) {
      // Show toast notification
      const replyText = newReplies.length === 1 ? 'reply' : 'replies';
      window.showToast(`💬 You have ${newReplies.length} new coach ${replyText}! Look for entries with the 'NEW REPLY' badge.`, "success", 8000);
      
      // Update calendar to highlight dates with new replies
      highlightCalendarDatesWithReplies(newReplies);
      
      // Trigger a refresh of the journal entries if the calendar tab is active
      const journalTab = document.getElementById("journalTab");
      const calendarTab = document.getElementById("calendarTab");
      
      if (journalTab && journalTab.style.display !== "none") {
        // If on journal tab, we don't need to reload anything as entries aren't displayed there
        console.log("📝 Journal tab is active - entries will show coach reply indicators when calendar is viewed");
      }
      
      if (calendarTab && calendarTab.style.display !== "none") {
        // If on calendar tab, reload past entries to show new reply indicators
        if (window.loadPastEntries) {
          console.log("📅 Refreshing past entries to show new coach replies");
          window.loadPastEntries();
        }
      }
    } else {
      console.log("✅ No new coach replies found");
    }
  } catch (error) {
    console.error("❌ Error checking for coach replies:", error);
    
    // Try to get more info about the error
    if (error.code) {
      console.error("Firebase error code:", error.code);
    }
    if (error.message) {
      console.error("Error message:", error.message);
    }
  }
}

// Function to highlight calendar dates with new coach replies
function highlightCalendarDatesWithReplies(entries) {
  entries.forEach(entry => {
    const entryDate = entry.date; // Already a Date object
    const dateKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`; // YYYY-MM-DD format
    
    // Find calendar cell for this date
    const calendarCells = document.querySelectorAll('[data-date]');
    calendarCells.forEach(cell => {
      if (cell.dataset.date === dateKey) {
        // Apply Sophy Coral highlight
        cell.style.backgroundColor = 'var(--accent, #d49489)';
        cell.style.color = '#fff';
        cell.style.fontWeight = 'bold';
        cell.style.border = '2px solid var(--accent-dark, #723332)';
        cell.title = 'New coach reply available!';
        
        // Add a visual indicator
        if (!cell.querySelector('.coach-reply-indicator')) {
          const indicator = document.createElement('span');
          indicator.className = 'coach-reply-indicator';
          indicator.innerHTML = '💬';
          indicator.style.position = 'absolute';
          indicator.style.top = '2px';
          indicator.style.right = '2px';
          indicator.style.fontSize = '0.7em';
          cell.style.position = 'relative';
          cell.appendChild(indicator);
        }
      }
    });
  });
}

// Make functions available globally
window.checkForCoachReplies = checkForCoachReplies;

// Create test user in local development
// Local development setup (only if on localhost)
if (location.hostname === "localhost") {
  try {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, "localhost", 8080);
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.log("🔧 Emulators connected for local development");
    
    // Create test user after emulator connection
    const createTestUser = httpsCallable(functions, "createTestUser");
    setTimeout(() => {
      createTestUser()
        .then(result => {
          console.log("✅ Test user created or already exists:", result.data);
        })
        .catch(err => {
          console.error("❌ Error creating test user:", err.message);
        });
    }, 500);
  } catch (error) {
    console.warn("⚠️ Emulator connection failed:", error.message);
  }
}

// === PATCH: Add refineManifestStatement button logic to frontend ===

// Inside DOMContentLoaded — right after `const functions = getFunctions(app);`
if (location.hostname === "localhost") {
  const createTestUser = httpsCallable(functions, "createTestUser");
  setTimeout(() => {
    createTestUser()
      .then(result => {
        console.log("✅ Test user created or already exists:", result.data);
      })
      .catch(err => {
        console.error("❌ Error creating test user:", err.message);
      });
  }, 500); // ⏱ Give auth/init a brief moment
}



// DOM references
const loginModal = document.getElementById("loginModal");
const signupModal = document.getElementById("signupModal");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const toggleSignup = document.getElementById("toggleSignup");
const backToLogin = document.getElementById("backToLogin");
const termsAgreement = document.getElementById("termsAgreement");
const privacyAgreement = document.getElementById("privacyAgreement"); 
const betaAgreement = document.getElementById("betaAgreement");
const signupSubmit = document.querySelector('#signupForm button[type="submit"]');
const forgotPassword = document.getElementById("forgotPassword");

// Toggle modals with delegated event listener
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "toggleSignup") {
    e.preventDefault();
    console.log("Toggle signup clicked");
    if (loginModal) loginModal.style.display = "none";
    if (signupModal) {
      signupModal.style.display = "flex";
      // Scroll modal to top to show logo and header
      setTimeout(() => {
        const modalContent = signupModal.querySelector('.card-block');
        if (modalContent) {
          modalContent.scrollTop = 0;
        }
        // Also ensure the modal container itself is scrolled to top
        signupModal.scrollTop = 0;
        // And ensure page is scrolled to top in case modal is tall on mobile
        window.scrollTo(0, 0);
      }, 50);
      console.log("Signup modal set to flex");
    } else {
      console.warn("signupModal not found");
    }
  } else if (e.target && e.target.id === "backToLogin") {
    e.preventDefault();
    console.log("Back to login clicked");
    if (signupModal) signupModal.style.display = "none";
    if (loginModal) {
      loginModal.style.display = "flex";
      // Scroll login modal to top to show logo and header
      setTimeout(() => {
        loginModal.scrollTop = 0;
        window.scrollTo(0, 0);
      }, 50);
      console.log("Login modal set to flex");
    } else {
      console.warn("loginModal not found");
    }
  }

});

// Agreement validation logic - disable submit if any agreement unchecked
function checkAllAgreements() {
  if (signupSubmit && termsAgreement && privacyAgreement && betaAgreement) {
    const allChecked = termsAgreement.checked && privacyAgreement.checked && betaAgreement.checked;
    signupSubmit.disabled = !allChecked;
  }
}

// Wire up agreement checkboxes
if (termsAgreement) termsAgreement.onchange = checkAllAgreements;
if (privacyAgreement) privacyAgreement.onchange = checkAllAgreements;
if (betaAgreement) betaAgreement.onchange = checkAllAgreements;

// Initial check on page load
checkAllAgreements();

// Helper function to check if running on localhost
function isLocalhost() {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

// Authentication functions with reCAPTCHA verification
async function signIn() {
  setTimeout(async () => {
    try {
      const email = document.getElementById("loginEmail")?.value?.trim();
      const password = document.getElementById("loginPassword")?.value || "";
      console.log("📧 Email:", email);
      console.log("🔒 Password:", password ? "●●●●●" : "(empty)");

      if (!email || !password) {
        showToast("Please enter both email and password.", "warning");
        return;
      }

      // Check reCAPTCHA v2 for production
      let recaptchaResponse = null;
      if (!isLocalhost()) {
        console.log("🔍 Checking reCAPTCHA v2 for production environment...");
        
        // Check if reCAPTCHA API is loaded
        if (typeof grecaptcha === 'undefined') {
          showToast("reCAPTCHA is still loading. Please wait a moment and try again.", "warning");
          return;
        }

        // Get reCAPTCHA response from login form
        const loginRecaptchaWidget = document.querySelector('#loginModal .g-recaptcha');
        console.log("🎯 Login reCAPTCHA widget:", loginRecaptchaWidget);
        
        if (!loginRecaptchaWidget) {
          console.error("❌ reCAPTCHA widget not found in login modal");
          showToast("reCAPTCHA widget not found. Please refresh the page.", "error");
          return;
        }

        // Get reCAPTCHA response
        try {
          const widgetId = loginRecaptchaWidget.getAttribute('data-widget-id');
          if (widgetId !== null) {
            recaptchaResponse = grecaptcha.getResponse(parseInt(widgetId));
          } else {
            // Fallback: search through all widgets
            for (let i = 0; i < 10; i++) {
              try {
                const response = grecaptcha.getResponse(i);
                if (response) {
                  recaptchaResponse = response;
                  break;
                }
              } catch (e) {
                // Widget doesn't exist, continue
              }
            }
          }
        } catch (e) {
          console.log("reCAPTCHA response check failed:", e.message);
        }

        if (!recaptchaResponse) {
          console.error("❌ No reCAPTCHA response found");
          showToast("Please complete the reCAPTCHA verification by checking the box.", "warning");
          return;
        }

        console.log("✅ reCAPTCHA v2 response received:", recaptchaResponse.substring(0, 20) + "...");

        // Verify reCAPTCHA on server
        console.log("🔐 Sending reCAPTCHA verification request...");
        try {
          const verifyRecaptcha = httpsCallable(functions, 'verifyRecaptcha');
          await verifyRecaptcha({ token: recaptchaResponse });
          console.log("✅ reCAPTCHA v3 verified, proceeding with login...");
        } catch (error) {
          console.error("❌ reCAPTCHA verification failed:", error);
          showToast("reCAPTCHA verification failed. Please try again.", "error");
          return;
        }
      } else {
        console.log("🚧 Development Mode: Skipping reCAPTCHA verification for localhost");
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      document.getElementById("loginModal").style.display = "none";
      
      // Reset reCAPTCHA after successful login
      if (!isLocalhost()) {
        grecaptcha.reset();
      }
      
    } catch (err) {
      console.error("Sign in error:", err);
      
      // Reset reCAPTCHA on error
      if (!isLocalhost()) {
        grecaptcha.reset();
      }
      
      if (err.code === "permission-denied") {
        showToast("reCAPTCHA verification failed. Please try again.", "error");
      } else {
        showToast("Error signing in: " + err.message, "error");
      }
    }
  }, 100); // allow autofill to populate fields
}

async function signUp() {
  setTimeout(async () => {
    try {
      const email = document.getElementById("signupEmail")?.value?.trim();
      const password = document.getElementById("signupPassword")?.value || "";
      const username = document.getElementById("signupUsername")?.value?.trim() || "";
      const avatar = document.getElementById("signupAvatar")?.value?.trim() || "";
      
      // Check agreement checkboxes
      const termsAgreed = document.getElementById("termsAgreement")?.checked;
      const privacyAgreed = document.getElementById("privacyAgreement")?.checked;
      const betaAgreed = document.getElementById("betaAgreement")?.checked;
      
      console.log("📧 Email:", email);
      console.log("🔒 Password:", password ? "●●●●●" : "(empty)");

      if (!email || !password) {
        showToast("Please enter both email and password.", "warning");
        return;
      }

      // Validate all agreements are checked
      if (!termsAgreed || !privacyAgreed || !betaAgreed) {
        showToast("Please accept all agreements to join the InkWell community. We value your understanding of our terms and commitment to this beta experience.", "warning");
        return;
      }

      // Check reCAPTCHA v2 for production  
      let recaptchaResponse = null;
      if (!isLocalhost()) {
        console.log("🔍 Checking reCAPTCHA v2 for production environment...");
        
        // Check if reCAPTCHA API is loaded
        if (typeof grecaptcha === 'undefined') {
          showToast("reCAPTCHA is still loading. Please wait a moment and try again.", "warning");
          return;
        }

        // Get reCAPTCHA response from signup form
        const signupRecaptchaWidget = document.querySelector('#signupModal .g-recaptcha');
        console.log("🎯 Signup reCAPTCHA widget:", signupRecaptchaWidget);
        
        if (!signupRecaptchaWidget) {
          console.error("❌ reCAPTCHA widget not found in signup modal");
          showToast("reCAPTCHA widget not found. Please refresh the page.", "error");
          return;
        }

        // Get reCAPTCHA response
        try {
          const widgetId = signupRecaptchaWidget.getAttribute('data-widget-id');
          if (widgetId !== null) {
            recaptchaResponse = grecaptcha.getResponse(parseInt(widgetId));
          } else {
            // Fallback: search through all widgets
            for (let i = 0; i < 10; i++) {
              try {
                const response = grecaptcha.getResponse(i);
                if (response) {
                  recaptchaResponse = response;
                  break;
                }
              } catch (e) {
                // Widget doesn't exist, continue
              }
            }
          }
        } catch (e) {
          console.log("reCAPTCHA response check failed:", e.message);
        }

        if (!recaptchaResponse) {
          console.error("❌ No reCAPTCHA response found");
          showToast("Please complete the reCAPTCHA verification by checking the box.", "warning");
          return;
        }

        console.log("✅ reCAPTCHA v2 response received:", recaptchaResponse.substring(0, 20) + "...");

        // Verify reCAPTCHA on server
        console.log("🔐 Sending reCAPTCHA verification request...");
        try {
          const verifyRecaptcha = httpsCallable(functions, 'verifyRecaptcha');
          await verifyRecaptcha({ token: recaptchaResponse });
          console.log("✅ reCAPTCHA v3 verified, proceeding with signup...");
        } catch (error) {
          console.error("❌ reCAPTCHA verification failed:", error);
          showToast("reCAPTCHA verification failed. Please try again.", "error");
          return;
        }
      } else {
        console.log("🚧 Development Mode: Skipping reCAPTCHA verification for localhost");
      }

      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      // Create comprehensive user document FIRST, before updating profile
      await setDoc(doc(db, "users", userCred.user.uid), {
        userId: userCred.user.uid,
        email: userCred.user.email,
        displayName: username || "",
        signupUsername: username || "",
        avatar: avatar || "",
        userRole: "journaler",
        agreementAccepted: true,
        special_code: "beta", // Tag all new signups with beta until ended
        // Default insight preferences for new users (opt-in by default)
        insightsPreferences: {
          weeklyEnabled: true,
          monthlyEnabled: true,
          createdAt: serverTimestamp()
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update Firebase Auth profile AFTER creating user document
      await updateProfile(userCred.user, { displayName: username || "" });

      // === MailChimp Integration ===
      // Note: Run MailChimp integration in background, don't block the UI
      setTimeout(async () => {
        try {
          const addToMailchimp = httpsCallable(functions, 'addToMailchimp');
          await addToMailchimp({ email });
          console.log('✅ Added to MailChimp successfully');
        } catch (mailchimpErr) {
          console.error('MailChimp integration failed:', mailchimpErr);
          // Optionally show a toast but do not block signup
          showToast('Signed up, but could not add to newsletter. You can join later.', 'warning');
        }
      }, 100);

      // Don't manually hide modals - let the auth state handler do it
      // This ensures proper timing and UI state management
      console.log('✅ Signup successful - auth state handler will manage UI');

      // Reset reCAPTCHA after successful signup
      if (!isLocalhost()) {
        grecaptcha.reset();
      }
      
    } catch (err) {
      console.error("Signup error:", err);
      
      // Reset reCAPTCHA on error
      if (!isLocalhost()) {
        grecaptcha.reset();
      }
      
      if (err.code === "permission-denied") {
        showToast("reCAPTCHA verification failed. Please try again.", "error");
      } else {
        showToast("Error signing up: " + err.message, "error");
      }
    }
  }, 100); // allow autofill to populate fields
}

// Expose auth functions globally
window.signIn = signIn;
window.signUp = signUp;

/* ===========================================================
   🚀 FAST LOGIN PATCH — CLOSE MODAL IMMEDIATELY
   =========================================================== */

function closeLoginModalFast() {
  const modal = document.getElementById("loginModal");
  if (!modal) return;
  modal.style.opacity = "0";
  setTimeout(() => {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }, 150);
}

function renderAppShell(user) {
  // Minimal visible UI — no heavy queries yet
  const mainUI = document.getElementById("mainUI");
  if (mainUI) {
    mainUI.style.visibility = "visible";
    mainUI.style.opacity = "1";
  }
  
  // Force refresh placeholder styles when app shell renders
  setTimeout(() => {
    if (typeof refreshPlaceholderStyles === 'function') {
      refreshPlaceholderStyles();
    }
  }, 300);
}

function initAppHeavy(user) {
  try {
    if (typeof window.loadUserJournal === "function") window.loadUserJournal(user);
    if (typeof window.loadPastEntries === "function") window.loadPastEntries(user);
    if (typeof window.initCoachModule === "function") window.initCoachModule(user);
    if (typeof window.initSophy === "function") window.initSophy(user);
  } catch (err) {
    console.warn("Heavy init error:", err);
  }
}

function scheduleHeavyInit(user) {
  const run = () => initAppHeavy(user);
  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 1500 });
  } else {
    requestAnimationFrame(() => setTimeout(run, 250));
  }
}

async function fastLoginHandler(event) {
  if (event) event.preventDefault();

  const email = document.getElementById("loginEmail")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value || "";

  // Close modal instantly
  closeLoginModalFast();
document.body.classList.add("fast-login-active");

  // Show shell right away
  renderAppShell(null);

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    const user = cred.user;
    scheduleHeavyInit(user);
  } catch (err) {
    console.error("Login failed:", err);
    const modal = document.getElementById("loginModal");
    if (modal) {
      modal.style.opacity = "1";
      modal.style.display = "block";
      modal.setAttribute("aria-hidden", "false");
    }
    const errEl = document.getElementById("loginError");
    if (errEl) {
      errEl.textContent = err.message || "Login failed. Please try again.";
      errEl.style.display = "block";
    }
  }
}

// Wire it up with reCAPTCHA-enabled login
(function wireSecureLoginToForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await signIn(); // Use the reCAPTCHA-enabled login function
  }, { passive: false });
})();


// Wire signup form to the main signUp() function
if (signupForm) {
  signupForm.onsubmit = async (e) => {
    e.preventDefault();
    await signUp();
  };
}

// Forgot password
if (forgotPassword) {
  forgotPassword.onclick = async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    if (!email) return alert("Enter your email first.");
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent.");
    } catch (err) {
      alert("Reset failed: " + err.message);
    }
  };
}


const animatedImg = document.getElementById("animatedImage");
const avatarImg = document.getElementById("avatarImage");

const ensureAvatar = (url) => {
  if (animatedImg && avatarImg) {
    avatarImg.src = url || "IMG_0310 2.jpg";
    animatedImg.classList.add("show");
    avatarImg.classList.remove("show");

    setInterval(() => {
      const isAvatarShowing = avatarImg.classList.contains("show");
      const fadeOut = isAvatarShowing ? avatarImg : animatedImg;
      const fadeIn = isAvatarShowing ? animatedImg : avatarImg;

      fadeOut.classList.remove("show");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fadeIn.classList.add("show");
        });
      });
    }, 30000);
  }
};


async function refineManifestStatement() {
  const input = document.getElementById("manifestInput");
  const suggestionBox = document.getElementById("manifestSuggestion");

  const rawText = input?.value?.trim();
  console.log("Refining manifest with input:", rawText);
  if (!rawText) {
    alert("Please write your manifest statement first.");
    return;
  }
  suggestionBox.innerHTML = "Refining...";

  try {
    const idToken = await auth.currentUser.getIdToken();

    const endpoint = location.hostname === "localhost"
      ? "http://localhost:5001/inkwell-alpha/us-central1/refineManifest"
      : "https://us-central1-inkwell-alpha.cloudfunctions.net/refineManifest";

    // Log the request for debugging
    console.log("Refining with:", rawText);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ statement: rawText })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error details:", errorText);
      throw new Error("Failed to fetch refinement");
    }

    const result = await response.json();
    let refined = result.refined || "(No suggestion returned)";
    
    // Clean the response to remove any internal prompting or stage directions
    if (refined !== "(No suggestion returned)") {
      refined = refined
        .replace(/^\*[^*]*\*\s*/g, '') // Remove opening stage directions
        .replace(/\*[^*]*\*$/g, '') // Remove ending stage directions  
        .replace(/\*[^*]*\*/g, '') // Remove any remaining stage directions
        .replace(/^\*with\s+warmth\s+and\s+empathy\*\s*/gi, '') // Remove specific empathy stage direction
        .replace(/^\*[^*]*warmth[^*]*\*\s*/gi, '') // Remove warmth-related stage directions
        .replace(/^\*[^*]*empathy[^*]*\*\s*/gi, '') // Remove empathy-related stage directions
        .replace(/I\s+sense\s+there\s+is\s+an\s+important\s+wish/gi, '') // Remove specific AI prompt leakage
        .replace(/Let's\s+take\s+a\s+moment\s+to\s+vividly\s+imagine/gi, '') // Remove prompt instruction leakage
        .replace(/Envision\s+yourself\s+feeling/gi, '') // Remove visualization prompt leakage
        .replace(/Picture\s+yourself\s+with/gi, '') // Remove picture prompt leakage
        .trim();
    }
    
    suggestionBox.innerHTML = `<div id="suggestedManifestText">${refined}</div>`;
  } catch (err) {
    console.error("Error refining manifest:", err);
    suggestionBox.innerHTML = "Something went wrong. Please try again.";
  }
}

window.askSophyToRefineManifest = refineManifestStatement;
async function askSophyToReflect() {
  const input = document.getElementById("journal");
  const insightBox = document.getElementById("sophyInsight");

  const rawText = input?.value?.trim();
  console.log("Sending reflection input to Sophy:", rawText);
  if (!rawText) {
    alert("Please write your journal entry first.");
    return;
  }

  insightBox.innerHTML = "Thinking...";

  try {
    const idToken = await auth.currentUser.getIdToken();

    const endpoint = location.hostname === "localhost"
      ? "http://localhost:5001/inkwell-alpha/us-central1/askSophy"
      : "https://us-central1-inkwell-alpha.cloudfunctions.net/askSophy";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ entry: rawText })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error details:", errorText);
      throw new Error("Failed to fetch reflection");
    }

    const result = await response.json();
    let insight = result.insight || "(No insight returned)";
    
    // Clean the response to remove any internal prompting or stage directions
    if (insight !== "(No insight returned)") {
      insight = insight
        .replace(/^\*[^*]*\*\s*/g, '') // Remove opening stage directions
        .replace(/\*[^*]*\*$/g, '') // Remove ending stage directions  
        .replace(/\*[^*]*\*/g, '') // Remove any remaining stage directions
        .replace(/^\*with\s+warmth\s+and\s+empathy\*\s*/gi, '') // Remove specific empathy stage direction
        .replace(/^\*[^*]*warmth[^*]*\*\s*/gi, '') // Remove warmth-related stage directions
        .replace(/^\*[^*]*empathy[^*]*\*\s*/gi, '') // Remove empathy-related stage directions
        .replace(/I\s+sense\s+there\s+is\s+an\s+important\s+wish/gi, '') // Remove specific AI prompt leakage
        .replace(/Let's\s+take\s+a\s+moment\s+to\s+vividly\s+imagine/gi, '') // Remove prompt instruction leakage
        .replace(/Envision\s+yourself\s+feeling/gi, '') // Remove visualization prompt leakage
        .replace(/Picture\s+yourself\s+with/gi, '') // Remove picture prompt leakage
        .trim();
    }
    
    insightBox.innerHTML = `<div id="sophyInsightText">${insight}</div>`;
    
    // Auto-select the "Save this Reflection in my Journal Entry" checkbox
    const autoInsertReflectionCheckbox = document.getElementById("autoInsertReflection");
    if (autoInsertReflectionCheckbox) autoInsertReflectionCheckbox.checked = true;
  } catch (err) {
    console.error("Error reflecting with Sophy:", err);
    insightBox.innerHTML = "Something went wrong. Please try again.";
  }
}
window.askSophyToReflect = askSophyToReflect;
const refineBtn = document.getElementById("refineManifestBtn");
if (refineBtn) {
  refineBtn.onclick = refineManifestStatement;
}

const sophyBtn = document.getElementById("askSophyBtn");
if (sophyBtn) {
  sophyBtn.onclick = askSophyToReflect;
}

// Make calendar month/year globals
window.displayedMonth = new Date().getMonth();
window.displayedYear = new Date().getFullYear();

// Calendar build function
async function buildCalendar() {
  const container = document.getElementById("calendarContainer");
  container.innerHTML = "";

  const snapshot = await getDocs(query(
    collection(db, "journalEntries"),
    where("userId", "==", currentUserId)
  ));

  const markedDates = new Set();
  const datesWithUnreadReplies = new Set();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.();
    if (createdAt &&
        createdAt.getFullYear() === window.displayedYear &&
        createdAt.getMonth() === window.displayedMonth) {
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;
      markedDates.add(key);
      
      // Track dates with unread coach replies
      if (data.newCoachReply === true) {
        datesWithUnreadReplies.add(key);
      }
    }
  });

  const currentMonthHeading = document.createElement("h3");
  const tempDate = new Date(window.displayedYear, window.displayedMonth, 1);
  currentMonthHeading.textContent = `${tempDate.toLocaleString('default', { month: 'long' })} ${window.displayedYear}`;
  currentMonthHeading.style.textAlign = "center";
  currentMonthHeading.style.color = "var(--font-main)";
  currentMonthHeading.style.marginBottom = "1.5rem";
  currentMonthHeading.style.fontSize = "1.1rem";
  currentMonthHeading.style.fontWeight = "500";

  container.appendChild(currentMonthHeading);

 const calendarTable = document.createElement("table");
calendarTable.style.width = "100%";
calendarTable.style.maxWidth = "100%";
calendarTable.style.textAlign = "center";
calendarTable.style.borderCollapse = "collapse";
calendarTable.style.margin = window.innerWidth <= 768 ? "1em -8px 0 -8px" : "1em auto 0 auto";
calendarTable.style.tableLayout = "fixed";
calendarTable.style.boxSizing = "border-box";
// Mobile optimization: wider table on small screens
if (window.innerWidth <= 768) {
  calendarTable.style.width = "calc(100% + 16px)";
  calendarTable.style.fontSize = "16px";
}

  const headerRow = document.createElement("tr");
  const days = CONFIG.calendar.DAYS_OF_WEEK; // ✅ clean and safe
  days.forEach(day => {
    const th = document.createElement("th");
    th.textContent = day;
    // Mobile-optimized padding and sizing
    th.style.padding = window.innerWidth <= 768 ? "14px 6px" : "0.5em";
    th.style.fontSize = window.innerWidth <= 768 ? "16px" : "inherit";
    th.style.minWidth = window.innerWidth <= 768 ? "52px" : "auto";
    headerRow.appendChild(th);
  });
  calendarTable.appendChild(headerRow);

  const firstDay = new Date(window.displayedYear, window.displayedMonth, 1).getDay();
  const daysInMonth = new Date(window.displayedYear, window.displayedMonth + 1, 0).getDate();

  let row = document.createElement("tr");
  for (let i = 0; i < firstDay; i++) {
    row.appendChild(document.createElement("td"));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    if ((row.children.length % 7) === 0) {
      calendarTable.appendChild(row);
      row = document.createElement("tr");
    }
    const td = document.createElement("td");
    td.textContent = day;
    td.style.cursor = "pointer";
    // Mobile-optimized calendar cells
    td.style.padding = window.innerWidth <= 768 ? "14px 6px" : "0.5em";
    td.style.fontSize = window.innerWidth <= 768 ? "16px" : "inherit";
    td.style.minWidth = window.innerWidth <= 768 ? "52px" : "auto";
    td.style.height = window.innerWidth <= 768 ? "52px" : "auto";
    td.style.border = "1px solid #ccc";

    const key = `${window.displayedYear}-${String(window.displayedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Add data-date attribute for coach reply highlighting
    td.setAttribute('data-date', key);
    
if (markedDates.has(key)) {
  // Check global state first (set by updateCalendarHighlighting)
  const globalUnreadReplies = window.globalDatesWithUnreadReplies || new Set();
  
  if (globalUnreadReplies.has(key)) {
    // Has unread coach replies - use coral
    td.style.backgroundColor = 'var(--accent, #d49489)';
    td.style.border = "2px solid var(--accent, #d49489)";
    td.style.color = '#fff';
    td.style.fontWeight = 'bold';
    td.style.boxShadow = "0 0 4px rgba(212, 148, 137, 0.5)";
    td.title = "Journal entry with unread coach reply";
  } else if (datesWithUnreadReplies.has(key)) {
    // Local check still shows unread - use coral (backup)
    td.style.backgroundColor = 'var(--accent, #d49489)';
    td.style.border = "2px solid var(--accent, #d49489)";
    td.style.color = '#fff';
    td.style.fontWeight = 'bold';
    td.style.boxShadow = "0 0 4px rgba(212, 148, 137, 0.5)";
    td.title = "Journal entry with unread coach reply";
  } else {
    // No unread replies - use teal
    td.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-secondary').trim();
    td.style.color = '#fff';
    td.style.border = "1px solid #ccc";
    td.style.fontWeight = 'normal';
    td.style.boxShadow = '';
    td.title = "Journal entry";
  }
}

    td.onclick = () => {
      console.log("📅 Day clicked:", window.displayedYear, window.displayedMonth, day);
      showPromptsByDate(window.displayedYear, window.displayedMonth, day);
    };

    row.appendChild(td);
  }

  calendarTable.appendChild(row);

// Fix for calendar width issue - wrap in proper container
const containerWrapper = document.createElement("div");
containerWrapper.className = "entries-container";
containerWrapper.style.cssText = `
  display: flex;
  flex-direction: column;
  gap: 1em;
  width: calc(100% - 2em);
  max-width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 0 1em;
  overflow-x: hidden;
`;
containerWrapper.appendChild(calendarTable);
container.appendChild(containerWrapper);


}
window.buildCalendar = buildCalendar;

async function showPromptsByDate(year, month, day) {
  console.log("🔥 Full entry card rendering is ACTIVE");


  const pastEntriesContainer = document.getElementById("pastEntries");
if (pastEntriesContainer) pastEntriesContainer.innerHTML = "";

// Clear search results when showing date entries
const searchResultsContainer = document.getElementById("searchResults");
if (searchResultsContainer) searchResultsContainer.innerHTML = "";


  
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const snapshot = await getDocs(query(
    collection(db, "journalEntries"),
    where("userId", "==", auth.currentUser.uid)
  ));

  const matches = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.();
    if (createdAt) {
      const entryDateKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;
      if (entryDateKey === dateKey) {
        matches.push({
  id: doc.id, // Include the document ID
  text: data.text,
  contextManifest: data.contextManifest,
  manifestData: data.manifestData, // Add manifestData field
  reflectionNote: data.reflectionNote,
  reflectionUsed: data.reflectionUsed, // Add reflectionUsed field
  coachResponse: data.coachResponse,
  promptUsed: data.promptUsed || "",
  tags: data.tags || [],
  attachments: data.attachments || [],
  newCoachReply: data.newCoachReply || false, // Include coach reply flag
  createdAt
});
      }
    }
  });
matches.sort((a, b) => b.createdAt - a.createdAt);
  if (matches.length === 0) {
    pastEntriesContainer.innerHTML = "<p>No journal entries found for this date.</p>";
    return;
  }

 // Create the same container structure as showPromptsByDate for consistent width
const container = document.createElement("div");
container.className = "entries-container";
container.style.cssText = `
  display: flex;
  flex-direction: column;
  gap: 1em;
  width: 100%;
  box-sizing: border-box;
  padding: 0 0.5em;
  max-width: 100%;
  overflow-x: hidden;
`;

  matches.forEach((entry) => {
    const card = createPastEntryCard(entry);
    console.log("🧩 Rendered card for:", entry.text?.slice(0, 40), entry.createdAt);
    container.appendChild(card);
  });

  console.log("🧪 Rendering", matches.length, "entries to #pastEntries");
  pastEntriesContainer.appendChild(container);
}

function createPastEntryCard(entry) {
  const card = document.createElement("div");
  card.className = "past-entry-block";
  // Set the data-entry-id attribute for the delete function
  card.setAttribute('data-entry-id', entry.id);
  
  // Check if dark theme is active
  const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
  
  card.style.cssText = `
    background: ${isDarkTheme ? 'linear-gradient(135deg, rgba(42, 105, 114, 0.15) 0%, rgba(30, 80, 85, 0.20) 100%)' : '#fff'};
    color: ${isDarkTheme ? '#2A6972' : '#000'};
    border-left: 4px solid var(--brand-secondary);
    padding: 1em;
    margin-bottom: 1.5em;
    border-radius: 6px;
    box-shadow: ${isDarkTheme ? '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(137, 201, 212, 0.1)' : '0 1px 4px rgba(0,0,0,0.1)'};
    backdrop-filter: blur(10px);
  `;

  const dateHeader = document.createElement("div");
  dateHeader.textContent = entry.createdAt?.toLocaleDateString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  }) || "(Unknown Date)";
  dateHeader.style.cssText = `
    font-weight: bold;
    margin-bottom: 0.5em;
    color: var(--brand-primary);
    font-size: 0.95em;
  `;
  card.appendChild(dateHeader);

 if (entry.contextManifest || entry.manifestData) {
  const manifestToggle = document.createElement("button");
  manifestToggle.textContent = "📜 Show Manifest";
  manifestToggle.style.cssText = `
    background: transparent;
    color: var(--brand-primary);
    border: none;
    cursor: pointer;
    font-size: 0.85em;
    margin-bottom: 0.25em;
  `;

  const manifestText = entry.manifestData ? 
    `Want: ${entry.manifestData.wish || 'Not specified'}<br/>
     Imagine: ${entry.manifestData.outcome || 'Not specified'}<br/>
     Snags: ${entry.manifestData.opposition || 'Not specified'}<br/>
     How: ${entry.manifestData.plan || 'Not specified'}` : 
    entry.contextManifest;

  const manifestContent = document.createElement("div");
  manifestContent.innerHTML = `<strong>Manifest Data:</strong><br/>${manifestText}`;
  const isDarkThemeForManifest = document.documentElement.getAttribute('data-theme') === 'dark';
  manifestContent.style.cssText = `
    display: none;
    font-size: 0.9em;
    color: ${isDarkThemeForManifest ? 'rgba(137, 201, 212, 0.9)' : '#555'};
    font-style: italic;
    margin-bottom: 0.5em;
    background: ${isDarkThemeForManifest ? 'rgba(42, 105, 114, 0.1)' : '#f8f9fa'};
    padding: 0.75em;
    border-radius: 5px;
    border-left: 4px solid var(--brand-primary);
    border: 1px solid ${isDarkThemeForManifest ? 'rgba(137, 201, 212, 0.2)' : '#e9ecef'};
  `;

  manifestToggle.onclick = () => {
    const isVisible = manifestContent.style.display === "block";
    manifestContent.style.display = isVisible ? "none" : "block";
    manifestToggle.textContent = isVisible ? "📜 Show Manifest" : "📜 Hide Manifest";
  };

  card.appendChild(manifestToggle);
  card.appendChild(manifestContent);
}

if (entry.promptUsed) {
  const promptToggle = document.createElement("button");
  promptToggle.textContent = "📝 Show Prompt";
  promptToggle.style.cssText = `
    background: transparent;
    color: var(--brand-primary);
    border: none;
    cursor: pointer;
    font-size: 0.85em;
    margin-bottom: 0.25em;
  `;

  const promptContent = document.createElement("div");
  promptContent.innerHTML = `<strong>Prompt:</strong> <em>${entry.promptUsed}</em>`;
  const isDarkThemeForPrompt = document.documentElement.getAttribute('data-theme') === 'dark';
  promptContent.style.cssText = `
    display: none;
    font-size: 0.9em;
    color: ${isDarkThemeForPrompt ? 'rgba(137, 201, 212, 0.9)' : '#555'};
    font-style: italic;
    margin-bottom: 0.5em;
    background: ${isDarkThemeForPrompt ? 'rgba(42, 105, 114, 0.1)' : '#f8f9fa'};
    padding: 0.75em;
    border-radius: 5px;
    border-left: 4px solid var(--brand-primary);
    border: 1px solid ${isDarkThemeForPrompt ? 'rgba(137, 201, 212, 0.2)' : '#e9ecef'};
  `;

  promptToggle.onclick = () => {
    const isVisible = promptContent.style.display === "block";
    promptContent.style.display = isVisible ? "none" : "block";
    promptToggle.textContent = isVisible ? "📝 Show Prompt" : "📝 Hide Prompt";
  };

  card.appendChild(promptToggle);
  card.appendChild(promptContent);
}

if (entry.reflectionUsed) {
  const reflectionToggle = document.createElement("button");
  reflectionToggle.textContent = "💭 Show Reflection";
  reflectionToggle.style.cssText = `
    background: transparent;
    color: var(--brand-primary);
    border: none;
    cursor: pointer;
    font-size: 0.85em;
    margin-bottom: 0.25em;
  `;

  const reflectionContent = document.createElement("div");
  reflectionContent.innerHTML = `<strong>Sophy's Reflection:</strong><br/>${entry.reflectionUsed}`;
  const isDarkThemeForReflection = document.documentElement.getAttribute('data-theme') === 'dark';
  reflectionContent.style.cssText = `
    display: none;
    font-size: 0.9em;
    color: ${isDarkThemeForReflection ? 'rgba(137, 201, 212, 0.9)' : '#555'};
    font-style: italic;
    margin-bottom: 0.5em;
    background: ${isDarkThemeForReflection ? 'rgba(42, 105, 114, 0.1)' : '#f8f9fa'};
    padding: 0.75em;
    border-radius: 5px;
    border-left: 4px solid var(--brand-primary);
    border: 1px solid ${isDarkThemeForReflection ? 'rgba(137, 201, 212, 0.2)' : '#e9ecef'};
  `;

  reflectionToggle.onclick = () => {
    const isVisible = reflectionContent.style.display === "block";
    reflectionContent.style.display = isVisible ? "none" : "block";
    reflectionToggle.textContent = isVisible ? "💭 Show Reflection" : "💭 Hide Reflection";
  };

  card.appendChild(reflectionToggle);
  card.appendChild(reflectionContent);
}

  const body = document.createElement("div");
  body.textContent = entry.text;
  body.className = 'entry-text';
  body.style.marginBottom = "0.75em";
  card.appendChild(body);

  if (entry.reflectionNote) {
    const note = document.createElement("div");
    note.innerHTML = `🧠 <strong>Reflection:</strong> ${entry.reflectionNote}`;
    const isDarkThemeForNote = document.documentElement.getAttribute('data-theme') === 'dark';
    note.style.cssText = `
      font-size: 0.9em;
      background: ${isDarkThemeForNote ? 'rgba(42, 105, 114, 0.1)' : '#f9f9f9'};
      color: ${isDarkThemeForNote ? 'rgba(137, 201, 212, 0.9)' : 'inherit'};
      padding: 0.75em;
      border-left: 4px solid var(--brand-secondary);
      border-radius: 5px;
      margin-bottom: 0.5em;
      border: ${isDarkThemeForNote ? '1px solid rgba(137, 201, 212, 0.2)' : 'none'};
    `;
    card.appendChild(note);
  }

  if (entry.coachResponse?.text || typeof entry.coachResponse === "string") {
    const coach = document.createElement("div");
    coach.innerHTML = `🧑‍🏫 <strong>Coach replied:</strong> ${entry.coachResponse.text || entry.coachResponse}`;
    const isDarkThemeForCoach = document.documentElement.getAttribute('data-theme') === 'dark';
    coach.style.cssText = `
      font-size: 0.9em;
      background: ${isDarkThemeForCoach ? 'rgba(42, 105, 114, 0.1)' : '#fff3ea'};
      color: ${isDarkThemeForCoach ? 'rgba(137, 201, 212, 0.9)' : 'inherit'};
      padding: 0.75em;
      border-left: 4px solid #FFA76D;
      border-radius: 5px;
      margin-bottom: 0.5em;
      border: ${isDarkThemeForCoach ? '1px solid rgba(137, 201, 212, 0.2)' : 'none'};
    `;
    card.appendChild(coach);
  }


  if (Array.isArray(entry.attachments)) {
    const filesSection = document.createElement("div");
    filesSection.style.marginTop = "0.5em";

    entry.attachments.forEach(file => {
      const ext = file.url?.split('.').pop()?.toLowerCase();
      if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) {
        const img = document.createElement("img");
        img.src = file.url;
        img.alt = file.name || "Attached image";
        img.style.maxWidth = "100px";
        img.style.marginRight = "0.5em";
        filesSection.appendChild(img);
      } else {
        const link = document.createElement("a");
        link.href = file.url;
        link.target = "_blank";
        link.textContent = file.name || file.url;
        link.style.display = "block";
        filesSection.appendChild(link);
      }
    });

    card.appendChild(filesSection);
}

// Always check for coach replies - like Show Prompt
const checkForCoachReplies = async () => {
  try {
    const repliesRef = collection(db, "journalEntries", entry.id, "coachReplies");
    const repliesSnapshot = await getDocs(repliesRef);
    
    if (!repliesSnapshot.empty) {
      // Create coach replies section
      const coachRepliesSection = document.createElement("div");
      const isDarkThemeForCoachReplies = document.documentElement.getAttribute('data-theme') === 'dark';
      coachRepliesSection.style.cssText = `
        background: ${isDarkThemeForCoachReplies ? 'rgba(42, 105, 114, 0.1)' : '#f8f9fa'};
        border-left: 4px solid var(--brand-secondary, #388b97);
        padding: 1em;
        margin: 1em 0;
        border-radius: 8px;
        position: relative;
        border: 1px solid ${isDarkThemeForCoachReplies ? 'rgba(42, 105, 114, 0.3)' : '#e9ecef'};
        box-shadow: ${isDarkThemeForCoachReplies ? '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(42, 105, 114, 0.1)' : '0 2px 4px rgba(0,0,0,0.1)'};
        ${entry.newCoachReply ? 'border-left: 4px solid var(--accent, #d49489);' : ''}
      `;
      
      const coachRepliesTitle = document.createElement("h4");
      coachRepliesTitle.innerHTML = entry.newCoachReply ? "💬 New Coach Reply" : "💬 Coach Reply";
      coachRepliesTitle.style.cssText = `
        margin: 0 0 0.5em 0;
        color: ${isDarkThemeForCoachReplies ? '#2A6972' : '#333'};
        font-size: 0.9em;
        font-weight: 600;
      `;
      coachRepliesSection.appendChild(coachRepliesTitle);
      
      // Display all coach replies
      repliesSnapshot.forEach(replyDoc => {
        const replyData = replyDoc.data();
        const replyDate = replyData.timestamp?.toDate?.()?.toLocaleString() || "Recent";
        
        const replyDiv = document.createElement("div");
        const isDarkThemeForReplyDiv = document.documentElement.getAttribute('data-theme') === 'dark';
        replyDiv.style.cssText = `
          background: ${isDarkThemeForReplyDiv ? 'rgba(42, 105, 114, 0.05)' : 'white'};
          padding: 0.75em;
          margin: 0.5em 0;
          border-radius: 6px;
          border: 1px solid ${isDarkThemeForReplyDiv ? 'rgba(42, 105, 114, 0.2)' : '#e9ecef'};
          box-shadow: ${isDarkThemeForReplyDiv ? '0 2px 6px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0,0,0,0.1)'};
        `;
        
        const replyText = document.createElement("p");
        replyText.textContent = replyData.replyText || replyData.reply || "No reply text found";
        replyText.style.cssText = `
          margin: 0 0 0.5em 0;
          color: ${isDarkThemeForReplyDiv ? '#2A6972' : '#333'};
          line-height: 1.5;
        `;
        
        const replyDateEl = document.createElement("p");
        replyDateEl.textContent = replyDate;
        replyDateEl.style.cssText = `
          margin: 0;
          font-size: 0.8em;
          color: ${isDarkThemeForReplyDiv ? 'rgba(42, 105, 114, 0.8)' : '#666'};
          font-style: italic;
        `;
        
        replyDiv.appendChild(replyText);
        replyDiv.appendChild(replyDateEl);
        coachRepliesSection.appendChild(replyDiv);
      });
      
      // Only add mark as read button if there's a new reply flag
      if (entry.newCoachReply) {
        const markReadBtn = document.createElement("button");
        markReadBtn.innerHTML = "✓ Mark as Read";
        markReadBtn.style.cssText = `
          background: var(--btn-bg, #2A6972);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 0.8em;
          margin-top: 0.5em;
          cursor: pointer;
          transition: background-color 0.2s;
        `;
        markReadBtn.onmouseover = () => markReadBtn.style.background = "var(--btn-hover, #388b97)";
        markReadBtn.onmouseout = () => markReadBtn.style.background = "var(--btn-bg, #2A6972)";
        markReadBtn.onclick = async (event) => {
          try {
            const entryRef = doc(db, "journalEntries", entry.id);
            await updateDoc(entryRef, { newCoachReply: false });
            
            // Update button to show "Read" state
            markReadBtn.innerHTML = "✓ Read";
            markReadBtn.style.background = "#6c757d";
            markReadBtn.style.cursor = "default";
            markReadBtn.onclick = null; // Disable further clicks
            markReadBtn.onmouseover = null; // Remove hover effects
            markReadBtn.onmouseout = null;
            
            // Find and update the parent entry card visual styling
            const entryCard = event.target.closest('.entry-card');
            if (entryCard) {
              // Reset border to teal (from coral)
              entryCard.style.borderLeft = '4px solid var(--brand-secondary, #7BB8C4)';
              entryCard.style.boxShadow = '';
              
              // Reset background to normal theme-appropriate color
              const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
              if (isDarkTheme) {
                entryCard.style.background = 'linear-gradient(135deg, rgba(42, 105, 114, 0.15) 0%, rgba(30, 80, 85, 0.20) 100%)';
              } else {
                entryCard.style.background = 'linear-gradient(180deg, #ffffff 0%, #f2f2f2 100%)';
              }
              
              // Remove NEW REPLY badge/sticker
              const newReplyBadge = entryCard.querySelector('.new-reply-badge, [style*="NEW REPLY"], .coach-reply-badge');
              if (newReplyBadge) {
                newReplyBadge.remove();
              }
              
              // Also check for and remove any "NEW REPLY" text spans
              const newReplySpans = entryCard.querySelectorAll('span');
              newReplySpans.forEach(span => {
                if (span.textContent.includes('NEW REPLY')) {
                  span.remove();
                }
              });
            }
            
            // Use the unified calendar update function
            if (window.markCoachRepliesAsRead) {
              // Call the app.html function to handle calendar updates
              setTimeout(async () => {
                // Trigger calendar highlighting update
                if (window.updateCalendarHighlighting && typeof window.updateCalendarHighlighting === 'function') {
                  await window.updateCalendarHighlighting();
                }
              }, 500);
            }
            
            console.log("✅ Coach reply marked as read for entry:", entry.id);
          } catch (error) {
            console.error("Error marking coach reply as read:", error);
            window.showToast("Failed to mark as read. Please try again.", "error");
          }
        };
        coachRepliesSection.appendChild(markReadBtn);
      }
      
      card.appendChild(coachRepliesSection);
    }
  } catch (error) {
    console.error("❌ Error checking for coach replies:", error);
    // Don't show errors for missing coach replies - it's normal
  }
};

// Check for coach replies on all entries
checkForCoachReplies();

// Only add NEW REPLY visual indicators if the flag is set
if (entry.newCoachReply) {
  console.log("🔍 Entry has newCoachReply flag, adding visual indicators for:", entry.id);
  
  // Add NEW REPLY badge
  const newReplyBadge = document.createElement("div");
  newReplyBadge.innerHTML = "NEW REPLY";
  newReplyBadge.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: var(--accent, #d49489);
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: bold;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(212, 148, 137, 0.3);
  `;
  card.style.position = "relative";
  card.appendChild(newReplyBadge);
  
  // Update card styling for new coach reply - keep original background, just add border
  card.style.borderLeft = "5px solid var(--accent, #d49489)";
  card.style.boxShadow = "0 0 10px rgba(212, 148, 137, 0.2)";
}

const actions = document.createElement("div");
actions.style.marginTop = "1em";

const editBtn = document.createElement("button");
editBtn.textContent = "✏️ Edit";
editBtn.style.cssText = `
  background-color: #2A6972;
  color: white;
  border: 1px solid #2A6972;
  padding: 12px 20px;
  font-size: 16px;
  min-width: 120px;
  border-radius: 8px;
  cursor: pointer;
  margin: 4px;
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font-weight: 500;
  touch-action: manipulation;
`;
editBtn.onmouseover = () => editBtn.style.backgroundColor = "#1e5157";
editBtn.onmouseout = () => editBtn.style.backgroundColor = "#2A6972";
editBtn.onclick = () => {
  // Show edit modal with current entry text
  const entryText = entry.text;
  const modal = document.getElementById('editEntryModal');
  const textarea = document.getElementById('editEntryText');
  const idInput = document.getElementById('editEntryId');
  
  // Set up the modal content
  textarea.value = entryText;
  idInput.value = entry.id;
  modal.style.display = 'flex';
  
  // Set up the save handler
  const saveButton = modal.querySelector('button[type="submit"]');
  saveButton.onclick = async (e) => {
    e.preventDefault();
    
    try {
      const newText = textarea.value.trim();
      const entryId = idInput.value;
      
      if (!newText || !entryId) {
        console.error('Missing text or entry ID');
        return;
      }

      const db = getFirestore();
      const entryRef = doc(db, "journalEntries", entryId);
      
      await updateDoc(entryRef, {
        text: newText,
        updatedAt: serverTimestamp()
      });

      // Update the card text immediately
      card.querySelector('.entry-text').textContent = newText;
      
      // Close the modal
      modal.style.display = 'none';
      
      // Clear the form
      textarea.value = '';
      idInput.value = '';
      
      // Show success message
      showToast('Entry updated successfully!', 'success');
    } catch (err) {
      console.error('Error updating entry:', err);
      showToast('Failed to update entry. Please try again.', 'error');
    }
  };
};

actions.appendChild(editBtn);

const deleteBtn = document.createElement("button");
deleteBtn.textContent = "🗑️ Delete";
deleteBtn.style.cssText = `
  background-color: #6b7280;
  color: white;
  border: 1px solid #6b7280;
  padding: 12px 20px;
  font-size: 16px;
  min-width: 120px;
  border-radius: 8px;
  cursor: pointer;
  margin: 4px;
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font-weight: 500;
  touch-action: manipulation;
`;
deleteBtn.onmouseover = () => deleteBtn.style.backgroundColor = "#4b5563";
deleteBtn.onmouseout = () => deleteBtn.style.backgroundColor = "#6b7280";
deleteBtn.onclick = async (e) => {
  e.preventDefault();
  const entryId = card.getAttribute('data-entry-id');
  
  if (!entryId) {
    console.error('No entry ID found');
    return;
  }

  // Create custom confirmation dialog
  const confirmDelete = () => {
    return new Promise((resolve) => {
      // Create confirmation overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;

      // Create confirmation dialog
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: var(--background-color, #1a1a1a);
        color: var(--text-color, #ffffff);
        padding: 24px;
        border-radius: 12px;
        border: 1px solid var(--border-color, #333);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        max-width: 400px;
        text-align: center;
        font-family: inherit;
      `;

      dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: var(--brand-primary, #2A6972);">Delete Entry</h3>
        <p style="margin: 0 0 24px 0; line-height: 1.5;">Are you sure you want to delete this entry? This cannot be undone.</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="cancelBtn" style="
            padding: 10px 20px;
            border: 1px solid var(--border-color, #333);
            background: transparent;
            color: var(--text-color, #ffffff);
            border-radius: 6px;
            cursor: pointer;
            font-family: inherit;
          ">Cancel</button>
          <button id="deleteBtn" style="
            padding: 10px 20px;
            border: none;
            background: #dc3545;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-family: inherit;
          ">Delete</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // Handle button clicks
      dialog.querySelector('#cancelBtn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(false);
      });

      dialog.querySelector('#deleteBtn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(true);
      });

      // Handle escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          document.body.removeChild(overlay);
          document.removeEventListener('keydown', handleEscape);
          resolve(false);
        }
      };
      document.addEventListener('keydown', handleEscape);

      // Handle overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(false);
        }
      });
    });
  };

  if (await confirmDelete()) {
    try {
      const db = getFirestore();
      const entryRef = doc(db, "journalEntries", entryId);
      const entrySnap = await getDoc(entryRef);

      if (!entrySnap.exists) {
        console.error('Entry not found');
        return;
      }

      const entryData = entrySnap.data();
      
      // Delete coach responses if they exist
      try {
        const responsesRef = collection(db, "journalEntries", entryId, "coachResponses");
        const responsesSnap = await getDocs(responsesRef);
        for (const doc of responsesSnap.docs) {
          await deleteDoc(doc.ref);
        }
      } catch (err) {
        console.error("Error deleting coach responses:", err);
      }

      // Delete any attached files
      if (entryData.attachments && entryData.attachments.length > 0) {
        const storage = getStorage();
        for (const attachment of entryData.attachments) {
          try {
            const fileRef = ref(storage, attachment.path);
            await deleteObject(fileRef);
          } catch (err) {
            console.error("Error deleting file:", err);
          }
        }
      }

      // Finally delete the main entry
      await deleteDoc(entryRef);
      
      // Remove the card from UI
      card.remove();
      
      // Show success message
      showToast('Entry deleted successfully', 'success');
    } catch (err) {
      console.error("Error deleting entry:", err);
      showToast("Failed to delete entry. Please try again.", 'error');
    }
  }
};

deleteBtn.className = "entry-btn themed-btn delete";
deleteBtn.style.cssText = `
  background-color: #ffdddd;
  color: #b00020;
  border: none;
  padding: 0.45em 1em;
  border-radius: 20px;
  font-size: 0.85em;
  cursor: pointer;
  margin-left: 0.5em;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
`;

actions.appendChild(deleteBtn);

card.appendChild(actions);

return card;
}


function changeMonth(delta) {
  window.displayedMonth += delta;

  if (window.displayedMonth < 0) {
    window.displayedMonth = 11;
    window.displayedYear -= 1;
  } else if (window.displayedMonth > 11) {
    window.displayedMonth = 0;
    window.displayedYear += 1;
  }

  buildCalendar();
}


// === SESSION TIMEOUT HANDLING ===
let inactivityTimeout = null;
let warningTimeout = null;

const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 14 * 60 * 1000;     // 1 minute before logout

function resetInactivityTimers() {
  clearTimeout(inactivityTimeout);
  clearTimeout(warningTimeout);

  if (auth.currentUser) {
    warningTimeout = setTimeout(() => {
      showInternalWarning("⚠️ You’ll be logged out in 1 minute due to inactivity.");
    }, WARNING_TIME);

    inactivityTimeout = setTimeout(() => {
      safeLogout("inactivity");
    }, INACTIVITY_LIMIT);
  }
}

// Handle return to login from goodbye modal - Use DOMContentLoaded for reliability
function setupReturnToLoginHandler() {
  const returnToLoginBtn = document.getElementById("returnToLoginBtn");
  if (returnToLoginBtn) {
    // Remove any existing event listeners to prevent duplicates
    returnToLoginBtn.onclick = null;
    
    returnToLoginBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("🔄 Return to Login clicked");
      
      // Hide goodbye modal immediately
      const goodbye = document.getElementById("goodbyeModal");
      if (goodbye) {
        goodbye.style.display = "none";
        console.log("✅ Goodbye modal hidden");
      }
      
      // Small delay to ensure modal transition completes
      setTimeout(() => {
        // Show login modal using multiple approaches for reliability
        showLoginModalReliably();
      }, 50);
    };
    console.log("✅ Return to login handler attached successfully");
  } else {
    console.warn("❌ Return to login button not found in DOM");
  }
}

// Reliable login modal display function
function showLoginModalReliably() {
  console.log("🔄 Attempting to show login modal");
  
  // Force clear any fast-login state that might interfere
  document.body.classList.remove("fast-login-active");
  
  // Get modal element
  const loginModal = document.getElementById("loginModal");
  if (!loginModal) {
    console.error("❌ Login modal element not found");
    return;
  }
  
  // Force reset all modal styles to ensure visibility
  loginModal.style.cssText = `
    display: flex !important;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.8);
    align-items: center;
    justify-content: center;
    z-index: 9999;
    opacity: 1;
  `;
  loginModal.setAttribute("aria-hidden", "false");
  
  // Clear form fields
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const errorDiv = document.getElementById("loginError");
  
  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";
  if (errorDiv) errorDiv.textContent = "";
  
  // Focus email field for better UX
  setTimeout(() => {
    if (emailInput) emailInput.focus();
  }, 100);
  
  console.log("✅ Login modal displayed with forced styling");
}

// Set up the handler when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupReturnToLoginHandler);
} else {
  // DOM is already loaded
  setupReturnToLoginHandler();
}

// Also set up handler after a short delay as additional insurance
setTimeout(setupReturnToLoginHandler, 1000);


// Replace alert with internal banner
function showInternalWarning(message) {
  let banner = document.getElementById("inactivityWarning");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "inactivityWarning";
    banner.style.cssText = `
      position: fixed;
      bottom: 1em;
      right: 1em;
      background: #fff3ea;
      color: #8a4f2b;
      padding: 1em;
      border-left: 4px solid #FFA76D;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      font-size: 0.9em;
    `;
    document.body.appendChild(banner);
  }
  banner.textContent = message;
}

// Remove warning if user interacts
function clearInternalWarning() {
  const banner = document.getElementById("inactivityWarning");
  if (banner) banner.remove();
}

// Setup user interaction listeners
["mousemove", "keydown", "mousedown", "touchstart"].forEach(event => {
  window.addEventListener(event, () => {
    resetInactivityTimers();
    clearInternalWarning();
  }, true);
});

// Note: Inactivity timer management is now handled in the main auth listener


// Safe logout helper
async function safeLogout(reason) {
  if (auth.currentUser) {
    localStorage.setItem("userJustLoggedOut", "true");
    await auth.signOut();

    const modal = document.getElementById("goodbyeModal");
    if (modal) {
      document.querySelector("main").style.display = "none";
      modal.style.display = "flex";
    } else {
      console.warn("🚨 Could not find #goodbyeModal");
    }
  }
}




// Global utility functions (moved out of auth listener to avoid duplication)
function refreshPlaceholderStyles() {
  const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
  
  const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
  const promptTopic = document.getElementById('promptTopic');
  const searchQuery = document.getElementById('searchQuery');
  
  inputs.forEach(input => {
    if (isDarkTheme) {
      input.style.removeProperty('color');
      input.style.removeProperty('background');
      input.classList.add('force-dark-placeholder');
      
      if (input.id === 'promptTopic' || input.id === 'searchQuery') {
        input.style.setProperty('color', '#89C9D4', 'important');
        input.style.setProperty('background', 'linear-gradient(135deg, rgba(42, 54, 58, 0.9) 0%, rgba(30, 42, 48, 0.95) 100%)', 'important');
        input.style.setProperty('border', '2px solid rgba(137, 201, 212, 0.3)', 'important');
        input.style.setProperty('caret-color', '#89C9D4', 'important');
      }
    } else {
      input.classList.remove('force-dark-placeholder');
      if (input.id === 'promptTopic' || input.id === 'searchQuery') {
        input.style.removeProperty('color');
        input.style.removeProperty('background');
        input.style.removeProperty('border');
        input.style.removeProperty('caret-color');
      }
    }
  });
}

// Export global utility functions
window.showPromptsByDate = showPromptsByDate;
window.changeMonth = changeMonth;
window.createPastEntryCard = createPastEntryCard;
window.refreshPlaceholderStyles = refreshPlaceholderStyles;

// Apply placeholder styles on page load
setTimeout(refreshPlaceholderStyles, 500);
});

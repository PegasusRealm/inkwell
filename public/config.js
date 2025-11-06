// Firebase Configuration
// Note: Firebase client API keys are designed to be public
// Security is enforced through Firebase Security Rules, not key secrecy
// See: https://firebase.google.com/docs/projects/api-keys

const firebaseConfig = {
  apiKey: "AIzaSyDivYKnp_SinGjL7iVVwSyQH-RnFHMFDM0",
  authDomain: "inkwell-alpha.firebaseapp.com", 
  projectId: "inkwell-alpha",
  storageBucket: "inkwell-alpha.appspot.com",
  messagingSenderId: "849610731668",
  appId: "1:849610731668:web:your-app-id"
};

// Export for use in other files
window.firebaseConfig = firebaseConfig;
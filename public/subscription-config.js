/**
 * InkWell Subscription Configuration
 * Central control for paywall features and pricing
 */

const SUBSCRIPTION_CONFIG = {
  // MASTER KILL SWITCH - Set to true to activate paywall globally
  PAYWALL_ENABLED: false,
  
  // Feature flags for granular control
  FEATURES: {
    RESTRICT_SMS: false,           // Block SMS for free users
    RESTRICT_AI: false,            // Limit AI to 20% for free users
    RESTRICT_PRACTITIONER: false,  // Block practitioner connections for non-Connect
    SHOW_UPGRADE_PROMPTS: false,   // Show upgrade modals/CTAs
    REQUIRE_PAYMENT: false,        // Actually charge users (vs mock success)
  },

  // Subscription tiers
  TIERS: {
    FREE: {
      id: 'free',
      name: 'Free',
      price: 0,
      priceId: null,
      features: {
        journaling: true,
        manifestTool: true,
        emailRecaps: true,
        aiPrompts: 0.20, // 20% of prompts use AI
        smsNotifications: false,
        practitionerConnection: false,
        dataExport: false,
      }
    },
    PLUS: {
      id: 'plus',
      name: 'Plus',
      price: 14.99,
      priceId: 'price_1SeRgCI0M1vXVDeSRRA8iYRh', // InkWell Plus - $14.99/month
      features: {
        journaling: true,
        manifestTool: true,
        emailRecaps: true,
        aiPrompts: 1.0, // 100% AI prompts
        smsNotifications: true,
        practitionerConnection: false,
        dataExport: true,
      }
    },
    CONNECT: {
      id: 'connect',
      name: 'Connect',
      price: 49.99,
      priceId: 'price_1SeRgCI0M1vXVDeStsmhHyOz', // InkWell Connect - $49.99/month
      features: {
        journaling: true,
        manifestTool: true,
        emailRecaps: true,
        aiPrompts: 1.0,
        smsNotifications: true,
        practitionerConnection: true,
        dataExport: true,
        interactionsPerMonth: 4,
        maxExtraInteractions: 3, // Can purchase up to 3 extra (7 total)
      }
    }
  },

  // Extra interaction pricing
  EXTRA_INTERACTION: {
    price: 9.99,
    priceId: 'price_1SeRgDI0M1vXVDeSKnNcmPOd', // Practitioner Interaction - $9.99 one-time
  },

  // Practitioner gift/discount system
  GIFT_SYSTEM: {
    ENABLED: true,
    MIN_DISCOUNT: 0.50, // Minimum 50% discount
    MAX_DISCOUNT: 1.0,  // Maximum 100% discount (free)
    GIFT_CODE_LENGTH: 8,
    EXPIRATION_DAYS: 90, // Gift codes expire after 90 days
  },

  // Revenue split for Connect tier
  REVENUE_SPLIT: {
    PRACTITIONER_PERCENT: 0.60,  // 60% to practitioner
    PLATFORM_PERCENT: 0.30,      // 30% to platform
    PROCESSING_PERCENT: 0.10,    // 10% to Stripe fees
  },

  // Practitioner limits
  PRACTITIONER_LIMITS: {
    MAX_CLIENTS: 50,
    MAX_INTERACTIONS_PER_CLIENT_MONTH: 7, // 4 included + 3 extra max
  },

  // Stripe configuration (set in Cloud Functions environment)
  STRIPE: {
    PUBLISHABLE_KEY: 'pk_test_51SeQgsI0M1vXVDeSVjEffDrq5M72lzEhhXjv8VBpk1WJNg1IjCxg32qZvuLr2XanvIhRf16q3sbub8FN8gXeq01L000krmiHC6',
    // Secret key stored in Cloud Functions config via Firebase secrets
  },
};

// Helper function to check if user has access to a feature
function hasFeatureAccess(userTier, feature) {
  if (!SUBSCRIPTION_CONFIG.PAYWALL_ENABLED) {
    return true; // All features unlocked when paywall disabled
  }

  const tier = SUBSCRIPTION_CONFIG.TIERS[userTier?.toUpperCase()] || SUBSCRIPTION_CONFIG.TIERS.FREE;
  
  // Handle AI prompts specially (returns probability 0.0-1.0)
  if (feature === 'aiPrompts') {
    return tier.features.aiPrompts;
  }
  
  return tier.features[feature] === true;
}

// Get tier details
function getTierDetails(tierId) {
  return SUBSCRIPTION_CONFIG.TIERS[tierId?.toUpperCase()] || SUBSCRIPTION_CONFIG.TIERS.FREE;
}

// Check if upgrade prompts should show
function shouldShowUpgradePrompts() {
  return SUBSCRIPTION_CONFIG.PAYWALL_ENABLED && SUBSCRIPTION_CONFIG.FEATURES.SHOW_UPGRADE_PROMPTS;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUBSCRIPTION_CONFIG,
    hasFeatureAccess,
    getTierDetails,
    shouldShowUpgradePrompts,
  };
}

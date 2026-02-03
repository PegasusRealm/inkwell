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
        periodInsights: false,
      }
    },
    PLUS: {
      id: 'plus',
      name: 'Plus',
      price: 14.99,
      priceId: 'price_1SeRgCI0M1vXVDeSRRA8iYRh', // InkWell Plus - $6.99/month (UPDATE STRIPE PRICE ID)
      features: {
        journaling: true,
        manifestTool: true,
        emailRecaps: true,
        aiPrompts: 1.0, // 100% AI prompts
        smsNotifications: true,
        practitionerConnection: false,
        dataExport: true,
        periodInsights: true,
      }
    },
    CONNECT: {
      id: 'connect',
      name: 'Connect',
      price: 49.99,
      priceId: 'price_1SeRgCI0M1vXVDeStsmhHyOz', // InkWell Connect - $29.99/month (UPDATE STRIPE PRICE ID)
      features: {
        journaling: true,
        manifestTool: true,
        emailRecaps: true,
        aiPrompts: 1.0,
        smsNotifications: true,
        practitionerConnection: true,
        dataExport: true,
        periodInsights: true,
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

  // Role-based permanent discounts (InkWell absorbs cost)
  ROLE_DISCOUNTS: {
    alpha: {
      plus: 1.0,      // 100% off Plus tier (free)
      connect: 0.25,  // 25% off Connect tier ($37.49/mo)
    },
    beta: {
      plus: 0.80,     // 80% off Plus tier ($2.99/mo)
      connect: 0.25,  // 25% off Connect tier ($37.49/mo)
    },
    coach: {
      plus: 0.25,     // 25% off Plus tier
      connect: 0.25,  // 25% off Connect tier
    },
  },

  // Special practitioners (can offer higher discounts by waiving their fee)
  SPECIAL_PRACTITIONERS: {
    // Hollis Verdant (founder) - waives practitioner fee for infrastructure-only pricing
    'hollis-verdant': {
      displayName: 'Hollis Verdant',
      discountPercent: 0.80,        // 80% off Connect ($9.99/mo)
      waivePractitionerFee: true,   // Practitioner gets $0
      isPenName: true,
      disclosure: 'Hollis Verdant is a pen name used by InkWell\'s founder for pro-bono alpha/beta client support.',
    },
  },

  // Practitioner gift/discount system
  GIFT_SYSTEM: {
    ENABLED: true,
    MIN_DISCOUNT: 0.50,           // Minimum 50% discount
    MAX_DISCOUNT: 1.0,            // Maximum 100% discount (free)
    GIFT_CODE_LENGTH: 8,
    DURATION_MONTHS: 3,           // Gift codes valid for 3 months (monthly billing)
    BILLING: 'monthly',           // Not prepaid - cancellable anytime
    PRORATION: true,              // Stripe auto-prorates on changes
    RENEWAL_ALLOWED: true,        // Practitioner can reissue after expiration
  },

  // Connect tier downgrade grace period
  CONNECT_REQUIREMENTS: {
    REQUIRES_PRACTITIONER: true,
    GRACE_PERIOD_DAYS: 14,        // 14 days to reconnect before auto-downgrade
    AUTO_DOWNGRADE: true,         // Downgrade to Plus if no practitioner after grace period
    ALLOW_FULL_PRICE: true,       // User can opt to keep Connect without practitioner
    NOTIFICATIONS: [0, 7, 13],    // Send emails on these days during grace period
  },

  // Revenue split for Connect tier
  REVENUE_SPLIT: {
    PRACTITIONER_FIXED: 30.00,   // Practitioner always gets $30 (not percentage)
    PLATFORM_PERCENT: 0.30,      // 30% to platform (on full price)
    PROCESSING_PERCENT: 0.10,    // 10% to Stripe fees (calculated on actual payment)
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

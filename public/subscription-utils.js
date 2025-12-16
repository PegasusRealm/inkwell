/**
 * InkWell Subscription Utilities
 * Feature gating, upgrade prompts, and subscription management
 */

// Load subscription config
let userSubscription = {
  tier: 'free',
  status: 'active',
  interactionsThisMonth: 0,
  interactionsLimit: 0,
};

/**
 * Initialize subscription data from Firestore
 */
async function initializeSubscriptionData() {
  if (!window.auth?.currentUser) {
    return;
  }

  try {
    const userId = window.auth.currentUser.uid;
    const userDoc = await window.getDoc(window.doc(window.db, 'users', userId));
    const userData = userDoc.data();

    userSubscription = {
      tier: userData?.subscriptionTier || 'free',
      status: userData?.subscriptionStatus || 'active',
      interactionsThisMonth: userData?.interactionsThisMonth || 0,
      interactionsLimit: userData?.interactionsLimit || 0,
      extraInteractionsPurchased: userData?.extraInteractionsPurchased || 0,
      giftedBy: userData?.giftedBy || null,
    };

    // Update UI with subscription badge
    updateSubscriptionBadge();
    
  } catch (error) {
    console.error('Failed to load subscription data:', error);
  }
}

/**
 * Check if user has access to a specific feature
 */
function checkFeatureAccess(feature) {
  // If paywall is disabled globally, grant access to everything
  if (!SUBSCRIPTION_CONFIG.PAYWALL_ENABLED) {
    return { hasAccess: true, tier: userSubscription.tier };
  }

  const tier = SUBSCRIPTION_CONFIG.TIERS[userSubscription.tier.toUpperCase()] || SUBSCRIPTION_CONFIG.TIERS.FREE;
  
  // Special handling for AI prompts (probability 0.0-1.0)
  if (feature === 'aiPrompts') {
    const probability = tier.features.aiPrompts || 0;
    const hasAccess = Math.random() < probability;
    return { 
      hasAccess, 
      tier: userSubscription.tier,
      probability,
    };
  }
  
  // Boolean features
  const hasAccess = tier.features[feature] === true;
  
  return {
    hasAccess,
    tier: userSubscription.tier,
    requiredTier: getRequiredTierForFeature(feature),
  };
}

/**
 * Get the minimum tier required for a feature
 */
function getRequiredTierForFeature(feature) {
  if (SUBSCRIPTION_CONFIG.TIERS.FREE.features[feature]) return 'free';
  if (SUBSCRIPTION_CONFIG.TIERS.PLUS.features[feature]) return 'plus';
  if (SUBSCRIPTION_CONFIG.TIERS.CONNECT.features[feature]) return 'connect';
  return null;
}

/**
 * Show upgrade prompt for a specific feature
 */
function showUpgradePrompt(feature, context = '') {
  if (!shouldShowUpgradePrompts()) {
    return;
  }

  const requiredTier = getRequiredTierForFeature(feature);
  if (!requiredTier || requiredTier === userSubscription.tier) {
    return;
  }

  const tierData = SUBSCRIPTION_CONFIG.TIERS[requiredTier.toUpperCase()];
  
  // Create upgrade modal content
  const featureNames = {
    smsNotifications: 'SMS Notifications',
    aiPrompts: 'Unlimited AI Prompts',
    practitionerConnection: 'Practitioner Connection',
    dataExport: 'Data Export',
  };

  const featureName = featureNames[feature] || feature;
  
  showUpgradeModal({
    title: `Upgrade to ${tierData.name}`,
    message: `${featureName} is available on the ${tierData.name} plan.`,
    feature: featureName,
    currentTier: userSubscription.tier,
    requiredTier: requiredTier,
    price: tierData.price,
    context,
  });
}

/**
 * Display upgrade modal
 */
function showUpgradeModal(options) {
  const modal = document.getElementById('upgradeModal');
  if (!modal) {
    createUpgradeModal();
    return showUpgradeModal(options);
  }

  document.getElementById('upgradeModalTitle').textContent = options.title;
  document.getElementById('upgradeModalMessage').innerHTML = `
    <p>${options.message}</p>
    <div class="upgrade-feature-highlight">
      <strong>✨ ${options.feature}</strong>
      ${options.context ? `<br><small>${options.context}</small>` : ''}
    </div>
  `;
  
  document.getElementById('upgradeModalPrice').textContent = `$${options.price}/month`;
  document.getElementById('upgradeModalTier').textContent = options.requiredTier;

  // Show modal using simple display style
  modal.style.display = 'flex';
}

/**
 * Create upgrade modal HTML (called once on page load)
 */
function createUpgradeModal() {
  const modalHTML = `
    <div class="modal" id="upgradeModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center;">
      <div class="modal-dialog modal-dialog-centered" style="max-width: 500px; margin: 2rem;">
        <div class="modal-content" style="border-radius: 16px; border: 1px solid var(--border-light); background: var(--bg-card); box-shadow: var(--shadow-xl);">
          <div class="modal-header" style="background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%); color: var(--font-white); border: none; border-radius: 16px 16px 0 0; padding: 1.5rem;">
            <h5 class="modal-title" id="upgradeModalTitle" style="font-family: var(--title-font); font-weight: 600;">Upgrade Your Plan</h5>
            <button type="button" class="close" onclick="document.getElementById('upgradeModal').style.display='none'" style="color: var(--font-white); opacity: 0.9; background: none; border: none; font-size: 1.5rem; cursor: pointer;">
              <span>&times;</span>
            </button>
          </div>
          <div class="modal-body" style="padding: 2rem;">
            <div id="upgradeModalMessage" class="mb-4" style="color: var(--font-secondary);"></div>
            
            <div class="text-center mb-4">
              <div style="font-size: 2.5rem; font-weight: bold; color: var(--brand-primary); font-family: var(--title-font);">
                <span id="upgradeModalPrice">$14.99</span>
              </div>
              <div style="color: var(--font-muted); font-size: 0.9rem;">per month</div>
            </div>

            <div class="upgrade-benefits mb-4">
              <h6 style="font-weight: 600; margin-bottom: 1rem; color: var(--font-main);">What's Included:</h6>
              <div id="upgradeBenefitsList"></div>
            </div>
          </div>
          <div class="modal-footer" style="border: none; padding: 1rem 2rem 2rem; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('upgradeModal').style.display='none'" style="border-radius: 8px; background: var(--btn-secondary); color: var(--font-main); border: 1px solid var(--border-medium); padding: 0.5rem 1.5rem; cursor: pointer;">
              Maybe Later
            </button>
            <button type="button" class="btn" onclick="startUpgradeFlow()" 
                    style="background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%); color: var(--font-white); border: none; border-radius: 8px; padding: 0.5rem 2rem; font-weight: 500; cursor: pointer;">
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>

    <style>
      .upgrade-feature-highlight {
        background: #f8f9ff;
        border-left: 4px solid #667eea;
        padding: 1rem;
        margin: 1rem 0;
        border-radius: 4px;
      }
      .upgrade-benefits {
        background: var(--bg-muted);
        padding: 1.5rem;
        border-radius: 8px;
        border: 1px solid var(--border-light);
      }
      .benefit-item {
        display: flex;
        align-items: center;
        margin-bottom: 0.75rem;
      }
      .benefit-item:last-child {
        margin-bottom: 0;
      }
      .benefit-icon {
        width: 24px;
        height: 24px;
        background: var(--brand-primary);
        color: var(--font-white);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 0.75rem;
        flex-shrink: 0;
        font-size: 0.85rem;
      }
    </style>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Start the upgrade flow (redirect to Stripe Checkout)
 */
async function startUpgradeFlow(tier = null) {
  try {
    // Check authentication
    const user = window.auth.currentUser;
    if (!user) {
      alert('Please sign in to upgrade your subscription.');
      return;
    }

    // Determine target tier
    const targetTier = tier || document.getElementById('upgradeModalTier')?.textContent || 'plus';
    const tierData = SUBSCRIPTION_CONFIG.TIERS[targetTier.toUpperCase()];
    
    if (!tierData.priceId || tierData.priceId === 'price_XXXXXXXXXXXXXX') {
      alert('Subscription system is not yet configured. Please contact support.');
      return;
    }

    // Show loading state
    showLoadingOverlay('Creating checkout session...');

    // Call Cloud Function to create Stripe checkout session
    const createCheckout = window.httpsCallable(window.functions, 'createCheckoutSession');
    const result = await createCheckout({
      priceId: tierData.priceId,
      mode: 'subscription',
      successUrl: `${window.location.origin}/app.html?upgrade_success=true`,
      cancelUrl: `${window.location.origin}/app.html`,
    });

    // Redirect to Stripe Checkout
    window.location.href = result.data.url;

  } catch (error) {
    console.error('Failed to start upgrade flow:', error);
    hideLoadingOverlay();
    alert('Failed to start upgrade process. Please try again.');
  }
}

/**
 * Purchase extra practitioner interactions
 */
async function purchaseExtraInteraction() {
  try {
    if (userSubscription.tier !== 'connect') {
      showUpgradePrompt('practitionerConnection', 'Extra interactions are only available on the Connect plan');
      return;
    }

    const remaining = 3 - (userSubscription.extraInteractionsPurchased || 0);
    if (remaining <= 0) {
      alert('You have already purchased the maximum extra interactions for this month (3).');
      return;
    }

    showLoadingOverlay('Creating checkout session...');

    const purchaseExtra = window.httpsCallable(window.functions, 'purchaseExtraInteraction');
    const result = await purchaseExtra({ quantity: 1 });

    window.location.href = result.data.url;

  } catch (error) {
    console.error('Failed to purchase extra interaction:', error);
    hideLoadingOverlay();
    alert(error.message || 'Failed to start purchase. Please try again.');
  }
}

/**
 * Update subscription badge in UI
 */
function updateSubscriptionBadge() {
  const badge = document.getElementById('subscriptionBadge');
  if (!badge) return;

  const tier = userSubscription.tier;
  const tierColors = {
    free: '#6c757d',
    plus: '#667eea',
    connect: '#764ba2',
  };

  const tierNames = {
    free: 'Free',
    plus: 'Plus',
    connect: 'Connect',
  };

  badge.style.background = tierColors[tier] || '#6c757d';
  badge.textContent = tierNames[tier] || 'Free';

  // Show gifted badge if applicable
  if (userSubscription.giftedBy) {
    const giftBadge = document.createElement('span');
    giftBadge.className = 'gift-badge';
    giftBadge.textContent = '🎁 Gifted';
    giftBadge.style.cssText = 'margin-left: 0.5rem; padding: 0.25rem 0.5rem; background: var(--bg-muted); color: var(--brand-primary); border: 1px solid var(--brand-light); border-radius: 4px; font-size: 0.75rem;';
    badge.parentElement.appendChild(giftBadge);
  }
}

/**
 * Show/hide loading overlay
 */
function showLoadingOverlay(message = 'Loading...') {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    overlay.innerHTML = `
      <div style="
        background: var(--bg-card);
        color: var(--font-main);
        padding: 2.5rem 3rem;
        border-radius: 16px;
        text-align: center;
        box-shadow: var(--shadow-xl);
        border: 1px solid var(--border-light);
      ">
        <div style="
          width: 48px;
          height: 48px;
          border: 4px solid var(--brand-light);
          border-top-color: var(--brand-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 1.5rem;
        "></div>
        <div id="loadingMessage" style="
          font-size: 1.1rem;
          font-weight: 500;
          font-family: var(--title-font);
          color: var(--font-main);
        ">${message}</div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(overlay);
  } else {
    document.getElementById('loadingMessage').textContent = message;
    overlay.style.display = 'flex';
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Check for successful upgrade on page load
 */
function checkUpgradeSuccess() {
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.get('upgrade_success') === 'true') {
    setTimeout(() => {
      alert('🎉 Welcome to InkWell Plus! Your subscription is now active.');
      window.history.replaceState({}, document.title, '/app.html');
      location.reload();
    }, 1000);
  }
  
  if (urlParams.get('extra_purchased') === 'true') {
    setTimeout(() => {
      alert('✅ Extra interaction purchased successfully!');
      window.history.replaceState({}, document.title, '/app.html');
      location.reload();
    }, 1000);
  }
}

// Initialize on auth state change
if (window.auth) {
  window.auth.onAuthStateChanged(user => {
    if (user) {
      initializeSubscriptionData();
      checkUpgradeSuccess();
    }
  });
} else {
  // Wait for auth to be initialized
  const checkAuth = setInterval(() => {
    if (window.auth) {
      clearInterval(checkAuth);
      window.auth.onAuthStateChanged(user => {
        if (user) {
          initializeSubscriptionData();
          checkUpgradeSuccess();
        }
      });
    }
  }, 100);
}

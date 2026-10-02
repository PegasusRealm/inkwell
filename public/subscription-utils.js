/**
 * Castalia Subscription Utilities
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
    practitionerConnection: 'Coach Connection',
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
                <span id="upgradeModalPrice">$6.99</span>
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

    // Close the subscription modal if open
    const modal = document.getElementById('subscriptionSelectionModal');
    if (modal) modal.style.display = 'none';

    // Map tiers to price IDs (LIVE MODE)
    const PRICE_IDS = {
      plus: 'price_1SeQaJIu1E0bDEgZq6V8lATE',           // $6.99/month
      plus_annual: 'price_1ToXwuIu1E0bDEgZRe1elpOv',    // $49.99/year (2026-07-01)
      // connect retired 2026-07-01 — coach layer dead
    };

    const targetTier = tier || 'plus';
    const priceId = PRICE_IDS[targetTier];
    
    if (!priceId) {
      alert('Invalid subscription tier. Please contact support.');
      return;
    }

    // Show loading state
    showLoadingOverlay('Creating checkout session...');

    // Call Cloud Function to create Stripe checkout session
    const createCheckout = window.httpsCallable(window.functions, 'createCheckoutSession');
    const result = await createCheckout({
      priceId: priceId,
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
async function checkUpgradeSuccess() {
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.get('upgrade_success') === 'true') {
    setTimeout(async () => {
      // Check which tier the user is now on
      let tier = 'plus';
      try {
        const currentUserId = window.currentUserId || window.auth?.currentUser?.uid;
        if (currentUserId && window.db) {
          const userDoc = await window.getDoc(window.doc(window.db, "users", currentUserId));
          if (userDoc.exists()) {
            tier = userDoc.data().subscriptionTier || 'plus';
          }
        }
      } catch (e) {
        console.error('Error fetching tier for welcome message:', e);
      }
      
      alert('🎉 Welcome to Castalia Plus! Your subscription is now active.\n\n💡 Tip: Go to Settings to enable SMS gratitude reminders and Sophy\'s weekly email insights!');
      
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

/**
 * Open the subscription selection modal
 * This is the main entry point for upgrading subscriptions
 */
async function openSubscriptionModal() {
  // Already on Plus? Say thank you, not "pay us". (Adam, 2026-07-04)
  let tier = 'free';
  try { tier = (await getUserSubscriptionData())?.tier || 'free'; } catch (e) {}
  document.getElementById('subscriptionSelectionModal')?.remove();
  createSubscriptionSelectionModal(['plus', 'connect', 'plus_annual'].includes(tier));
  document.getElementById('subscriptionSelectionModal').style.display = 'flex';
}

/**
 * Subscription modal — rebuilt 2026-07-04 on the v2 design language.
 * Token-driven (works in every theme), no gradients, no purple, no emojis.
 * Purchase actions are structural = teal. Free tier stated plainly.
 */
function createSubscriptionSelectionModal(alreadyPlus) {
  const panelOpen = `
    <div id="subscriptionSelectionModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(12, 18, 19, 0.72); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center; overflow-y: auto; padding: 1.5rem;">
      <div style="max-width: 720px; width: 100%; margin: auto; background: var(--bg-card); color: var(--font-main); border: 1px solid var(--border-light); border-radius: 16px; box-shadow: 0 32px 80px -24px rgba(0,0,0,0.5); position: relative; padding: 2rem 1.75rem 1.5rem;">
        <button onclick="document.getElementById('subscriptionSelectionModal').style.display='none'" aria-label="Close" style="position: absolute; top: 0.9rem; right: 1rem; background: none; border: none; color: var(--font-muted); font-size: 1.4rem; cursor: pointer; line-height: 1; padding: 0.2em;">&times;</button>`;
  const panelClose = `
      </div>
    </div>`;

  let body;
  if (alreadyPlus) {
    body = `
        <h2 style="margin: 0 0 0.4rem; font-family: var(--title-font); font-size: 1.5rem; font-weight: 500; color: var(--font-main); text-align: center;">You are already on Plus</h2>
        <p style="margin: 0 0 1.2rem; text-align: center; color: var(--font-secondary); font-size: 0.95rem; line-height: 1.6;">
          Thank you for backing Castalia. Everything unlocks for you already.<br>
          Looking for something Plus does not do yet? Tell the team and we will try to build it into a future release.
        </p>
        <div style="display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap;">
          <a href="mailto:support@pegasusrealm.com?subject=Castalia%20feature%20idea" class="btn" style="text-decoration: none; display: inline-flex; align-items: center;">Email the team</a>
          <button class="btn btn-gray" onclick="document.getElementById('subscriptionSelectionModal').style.display='none'">Close</button>
        </div>`;
  } else {
    const feature = (t) => `<li style="margin-bottom: 0.35rem; color: var(--font-secondary); font-size: 0.9rem;">${t}</li>`;
    const features = feature('Unlimited Sophy prompts, reflections, and insights') +
      feature('Weekly and monthly pattern insights by email') +
      feature('SMS nudges and milestone messages') +
      feature('Personalized practices drawn from your own journal') +
      feature('Full data export');
    body = `
        <h2 style="margin: 0 0 0.3rem; font-family: var(--title-font); font-size: 1.5rem; font-weight: 500; color: var(--font-main); text-align: center;">Go further with Plus</h2>
        <p style="margin: 0 0 1.4rem; text-align: center; color: var(--font-secondary); font-size: 0.95rem;">More of Sophy. Deeper patterns. The journal that keeps learning you.</p>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 240px; border: 1px solid var(--border-light); border-radius: 14px; padding: 1.25rem;">
            <div style="font-family: var(--body-font); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--font-muted); margin-bottom: 0.5rem;">Monthly</div>
            <div style="font-family: var(--title-font); font-size: 2rem; color: var(--font-main);">$6.99<span style="font-size: 0.9rem; color: var(--font-muted);"> /month</span></div>
            <ul style="margin: 0.9rem 0 1.1rem; padding-left: 1.1rem;">${features}</ul>
            <button class="btn" style="width: 100%;" onclick="startUpgradeFlow('plus')">Start Plus monthly</button>
          </div>
          <div style="flex: 1; min-width: 240px; border: 1.5px solid var(--brand-primary); border-radius: 14px; padding: 1.25rem; position: relative;">
            <span style="position: absolute; top: -0.7em; left: 1rem; background: var(--brand-primary); color: #fff; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.25em 0.7em; border-radius: 999px;">Best value</span>
            <div style="font-family: var(--body-font); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--font-muted); margin-bottom: 0.5rem;">Annual</div>
            <div style="font-family: var(--title-font); font-size: 2rem; color: var(--font-main);">$49.99<span style="font-size: 0.9rem; color: var(--font-muted);"> /year</span></div>
            <div style="font-size: 0.82rem; color: var(--brand-primary); font-weight: 600; margin-top: 0.15rem;">Save $34 a year, about $4.17 a month</div>
            <ul style="margin: 0.9rem 0 1.1rem; padding-left: 1.1rem;">${features}</ul>
            <button class="btn" style="width: 100%;" onclick="startUpgradeFlow('plus_annual')">Start Plus yearly</button>
          </div>
        </div>
        <p style="margin: 1.2rem 0 0; text-align: center; color: var(--font-muted); font-size: 0.8rem;">
          Cancel anytime. Secure payment via Stripe.<br>
          The free journal stays fully functional, forever. Plus just goes deeper.
        </p>`;
  }

  document.body.insertAdjacentHTML('beforeend', panelOpen + body + panelClose);
}

// Expose functions globally
window.openSubscriptionModal = openSubscriptionModal;
window.showSubscriptionModal = openSubscriptionModal;
window.startUpgradeFlow = startUpgradeFlow;

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

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
      plus_annual: 'price_1SyMozIu1E0bDEgZNZ8zoJt2',    // $69.99/year
      connect: 'price_1SeQcGIu1E0bDEgZQWWqkrjK',        // $29.99/month
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
      
      if (tier === 'connect') {
        alert('🎉 Welcome to InkWell Connect! Your subscription is now active.\n\n💡 Tip: Go to Settings → My Coach to select your coach. Check out their bios to learn about their specialties and find the right fit for you!');
      } else {
        alert('🎉 Welcome to InkWell Plus! Your subscription is now active.\n\n💡 Tip: Go to Settings to enable SMS gratitude reminders and Sophy\'s weekly email insights!');
      }
      
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
function openSubscriptionModal() {
  // Create the modal if it doesn't exist
  let modal = document.getElementById('subscriptionSelectionModal');
  if (!modal) {
    createSubscriptionSelectionModal();
    modal = document.getElementById('subscriptionSelectionModal');
  }
  
  // Show the modal
  modal.style.display = 'flex';
}

/**
 * Create the subscription selection modal with all plan options
 */
function createSubscriptionSelectionModal() {
  const modalHTML = `
    <div id="subscriptionSelectionModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; overflow-y: auto; padding: 1.5rem;">
      <div style="max-width: 1000px; width: 100%; margin: auto; background: linear-gradient(180deg, #fefefe 0%, #f8fafc 100%); border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.1); overflow: hidden;">
        
        <!-- Premium Header with Coral/Purple Gradient -->
        <div style="background: linear-gradient(135deg, #D49489 0%, #B07A9E 40%, #805AD5 100%); padding: 2.5rem 2rem; text-align: center; position: relative; overflow: hidden;">
          <!-- Decorative circles -->
          <div style="position: absolute; top: -30px; left: -30px; width: 120px; height: 120px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
          <div style="position: absolute; bottom: -40px; right: -40px; width: 150px; height: 150px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
          <div style="position: absolute; top: 50%; right: 15%; width: 60px; height: 60px; background: rgba(255,255,255,0.06); border-radius: 50%;"></div>
          
          <button onclick="document.getElementById('subscriptionSelectionModal').style.display='none'" style="position: absolute; top: 1.25rem; right: 1.25rem; background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; backdrop-filter: blur(4px); box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10;" onmouseover="this.style.background='rgba(255,255,255,0.35)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">&times;</button>
          
          <div style="position: relative; z-index: 1;">
            <!-- Logo - 180px (3x original) -->
            <div style="margin-bottom: 0.5rem;">
              <img src="InkWell-Logo.png" alt="InkWell" style="height: 180px; filter: brightness(0) invert(1) drop-shadow(0 4px 8px rgba(0,0,0,0.3));" onerror="this.outerHTML='<span style=\\'font-family: Cormorant Garamond, Georgia, serif; font-size: 3.5rem; font-weight: 700; color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.3);\\'>InkWell</span>'">
            </div>
            <!-- Tagline -->
            <h2 style="margin: 0 0 0.5rem; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.6rem; font-weight: 500; color: #ffffff; letter-spacing: 0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.25);">Elevate Your Journaling Experience</h2>
            <p style="margin: 0; color: rgba(255,255,255,0.95); font-size: 1rem; max-width: 500px; margin: 0 auto; text-shadow: 0 1px 4px rgba(0,0,0,0.2);">Unlock the full power of AI-guided self-discovery and personal growth</p>
          </div>
        </div>
        
        <!-- Plans Grid -->
        <div style="padding: 2rem 1.5rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem;">
          
          <!-- Plus Monthly - Sophy Coral -->
          <div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.5rem; background: white; transition: all 0.3s; position: relative;" onmouseover="this.style.borderColor='#D49489'; this.style.boxShadow='0 8px 30px rgba(212,148,137,0.2)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
            <div style="text-align: center; margin-bottom: 1.25rem;">
              <h3 style="margin: 0 0 0.25rem; color: #1e293b; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.35rem; font-weight: 600;">Plus Monthly</h3>
              <p style="margin: 0; color: #64748b; font-size: 0.85rem;">Flexible month-to-month</p>
            </div>
            <div style="text-align: center; margin: 1.25rem 0; padding: 1rem 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
              <span style="font-size: 2.5rem; font-weight: 700; color: #D49489; font-family: 'Cormorant Garamond', Georgia, serif;">$6.99</span>
              <span style="color: #64748b; font-size: 0.95rem;">/month</span>
            </div>
            <ul style="list-style: none; padding: 0; margin: 0 0 1.25rem; font-size: 0.875rem; color: #475569;">
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #D49489; font-weight: 600;">✓</span> Unlimited AI insights</li>
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #D49489; font-weight: 600;">✓</span> SMS notifications</li>
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #D49489; font-weight: 600;">✓</span> Weekly email insights</li>
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #D49489; font-weight: 600;">✓</span> Priority support</li>
            </ul>
            <div style="background: linear-gradient(135deg, #fdf5f4 0%, #fbe9e6 100%); padding: 0.6rem; border-radius: 8px; margin-bottom: 1rem; text-align: center;">
              <span style="font-size: 0.8rem; color: #C2867D; font-weight: 500;">🎁 7-day free trial included</span>
            </div>
            <button onclick="startUpgradeFlow('plus')" style="width: 100%; padding: 0.875rem; background: linear-gradient(135deg, #D49489 0%, #C2867D 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 0.95rem; transition: all 0.2s; box-shadow: 0 4px 14px rgba(212,148,137,0.35);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(212,148,137,0.45)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 14px rgba(212,148,137,0.35)';">
              Start Free Trial
            </button>
          </div>
          
          <!-- Plus Annual - BEST VALUE - Sophy Coral -->
          <div style="border: 2px solid #D49489; border-radius: 16px; padding: 1.5rem; background: linear-gradient(180deg, #fefefe 0%, #fdf5f4 100%); position: relative; transform: scale(1.02); box-shadow: 0 8px 30px rgba(212,148,137,0.25);">
            <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #D49489 0%, #C2867D 100%); color: white; padding: 0.4rem 1.25rem; border-radius: 20px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 4px 12px rgba(212,148,137,0.3);">✨ Best Value</div>
            <div style="text-align: center; margin-bottom: 1.25rem; margin-top: 0.5rem;">
              <h3 style="margin: 0 0 0.25rem; color: #1e293b; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.35rem; font-weight: 600;">Plus Annual</h3>
              <p style="margin: 0; color: #D49489; font-size: 0.85rem; font-weight: 600;">Save $14 per year!</p>
            </div>
            <div style="text-align: center; margin: 1.25rem 0; padding: 1rem 0; border-top: 1px solid #fbe9e6; border-bottom: 1px solid #fbe9e6;">
              <span style="font-size: 2.5rem; font-weight: 700; color: #D49489; font-family: 'Cormorant Garamond', Georgia, serif;">$69.99</span>
              <span style="color: #64748b; font-size: 0.95rem;">/year</span>
              <div style="margin-top: 0.25rem; font-size: 0.8rem; color: #C2867D;">Just $5.83/month</div>
            </div>
            <ul style="list-style: none; padding: 0; margin: 0 0 1.25rem; font-size: 0.875rem; color: #475569;">
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #D49489; font-weight: 600;">✓</span> Everything in Monthly</li>
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #D49489; font-weight: 600;">✓</span> 2 months FREE</li>
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #D49489; font-weight: 600;">✓</span> Lock in your rate</li>
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #D49489; font-weight: 600;">✓</span> Priority support</li>
            </ul>
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 0.6rem; border-radius: 8px; margin-bottom: 1rem; text-align: center;">
              <span style="font-size: 0.8rem; color: #92400e; font-weight: 600;">🎁 7-day free trial included</span>
            </div>
            <button onclick="startUpgradeFlow('plus_annual')" style="width: 100%; padding: 0.875rem; background: linear-gradient(135deg, #D49489 0%, #C2867D 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 0.95rem; transition: all 0.2s; box-shadow: 0 4px 14px rgba(212,148,137,0.4);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(212,148,137,0.5)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 14px rgba(212,148,137,0.4)';">
              Start Free Trial
            </button>
          </div>
          
          <!-- Connect - Purple -->
          <div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.5rem; background: white; transition: all 0.3s;" onmouseover="this.style.borderColor='#805AD5'; this.style.boxShadow='0 8px 30px rgba(128,90,213,0.15)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
            <div style="text-align: center; margin-bottom: 1.25rem;">
              <h3 style="margin: 0 0 0.25rem; color: #1e293b; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.35rem; font-weight: 600;">Connect</h3>
              <p style="margin: 0; color: #64748b; font-size: 0.85rem;">Expert human coaching</p>
            </div>
            <div style="text-align: center; margin: 1.25rem 0; padding: 1rem 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
              <span style="font-size: 2.5rem; font-weight: 700; color: #805AD5; font-family: 'Cormorant Garamond', Georgia, serif;">$29.99</span>
              <span style="color: #64748b; font-size: 0.95rem;">/month</span>
            </div>
            <ul style="list-style: none; padding: 0; margin: 0 0 1.25rem; font-size: 0.875rem; color: #475569;">
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #805AD5; font-weight: 600;">✓</span> Everything in Plus</li>
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #805AD5; font-weight: 600;">✓</span> Certified coach access</li>
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #805AD5; font-weight: 600;">✓</span> 10 interactions/month</li>
              <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: #805AD5; font-weight: 600;">✓</span> Professional matching</li>
            </ul>
            <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); padding: 0.6rem; border-radius: 8px; margin-bottom: 1rem; text-align: center;">
              <span style="font-size: 0.8rem; color: #7c3aed; font-weight: 500;">👤 Real human guidance</span>
            </div>
            <button onclick="startUpgradeFlow('connect')" style="width: 100%; padding: 0.875rem; background: #805AD5; color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 0.95rem; transition: all 0.2s; box-shadow: 0 4px 14px rgba(128,90,213,0.3);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(128,90,213,0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 14px rgba(128,90,213,0.3)';">
              Get Human Support
            </button>
          </div>
          
        </div>
        
        <!-- Footer -->
        <div style="padding: 1.25rem 2rem; text-align: center; background: #f8fafc; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; color: #64748b; font-size: 0.85rem;">✨ All Plus plans include a 7-day free trial • Cancel anytime • Secure payment via Stripe</p>
        </div>
        
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
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

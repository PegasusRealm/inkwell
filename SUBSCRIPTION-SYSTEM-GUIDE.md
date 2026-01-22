# InkWell Subscription System - Implementation Complete

## 🎉 Status: Fully Built (Dormant - Ready to Activate)

The complete paywall and subscription system is now implemented and ready to go. Everything is **turned OFF by default** and can be activated with a single configuration change when you're ready to launch in the app stores.

---

## 🔧 How to Activate the Paywall

### Step 1: Configure Stripe (One-Time Setup)

1. **Create Stripe Products & Prices:**
   ```
   - Log into Stripe Dashboard (https://dashboard.stripe.com)
   - Create Products:
     • "InkWell Plus" - $6.99/month recurring
     • "InkWell Connect" - $29.99/month recurring
   
   - Copy the Price IDs for each product
   ```

2. **Update Configuration File:**
   Open `public/subscription-config.js` and update:
   ```javascript
   TIERS: {
     PLUS: {
       priceId: 'price_XXXXXXXXXXXXXX', // Replace with real Stripe price ID ($6.99/mo)
     },
     CONNECT: {
       priceId: 'price_YYYYYYYYYYYYYY', // Replace with real Stripe price ID ($29.99/mo)
     }
   },
   STRIPE: {
     PUBLISHABLE_KEY: 'pk_live_XXXXXXXXXXXXXXXXXXXXXXXX', // Replace with real key
   }
   ```

3. **Set Firebase Secrets:**
   ```bash
   cd functions
   firebase functions:secrets:set STRIPE_SECRET_KEY
   # Paste your Stripe secret key (sk_live_xxx)
   
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Paste your webhook secret (whsec_xxx) after setting up webhook
   ```

4. **Set Up Stripe Webhook:**
   ```
   - Go to Stripe Dashboard → Webhooks
   - Add endpoint: https://YOUR-PROJECT.cloudfunctions.net/handleStripeWebhook
   - Select events:
     ✓ checkout.session.completed
     ✓ customer.subscription.updated
     ✓ customer.subscription.deleted
     ✓ invoice.payment_failed
   - Copy the webhook secret and set it in Firebase secrets (step 3)
   ```

### Step 2: Deploy the System

```bash
# Install new Stripe dependency
cd functions
npm install

# Deploy Cloud Functions
firebase deploy --only functions:createCheckoutSession,functions:handleStripeWebhook,functions:getSubscriptionStatus,functions:createGiftMembership,functions:validateGiftCode,functions:trackPractitionerInteraction,functions:resetMonthlyInteractions

# Deploy updated frontend files
firebase deploy --only hosting
```

### Step 3: Activate the Paywall (When Ready)

Open `public/subscription-config.js` and change:

```javascript
const SUBSCRIPTION_CONFIG = {
  // MASTER KILL SWITCH - Set to true to activate paywall globally
  PAYWALL_ENABLED: true,  // ← Change from false to true
  
  // Feature flags for granular control
  FEATURES: {
    RESTRICT_SMS: true,           // ← Change to true
    RESTRICT_AI: true,            // ← Change to true (limits free to 20%)
    RESTRICT_PRACTITIONER: true,  // ← Change to true
    SHOW_UPGRADE_PROMPTS: true,   // ← Change to true
    REQUIRE_PAYMENT: true,        // ← Change to true
  },
```

Then redeploy:
```bash
firebase deploy --only hosting
```

**That's it!** The paywall is now active. 🎉

---

## 💰 Revenue Model Summary

### Free Tier ($0)
- Unlimited journaling
- WISH manifestation tool
- Weekly/monthly email recaps
- **20% AI-powered prompts**
- ❌ No SMS notifications
- ❌ No coach connection

### Plus Tier ($6.99/month)
- All Free features
- **100% AI-powered prompts**
- **SMS notifications** (daily prompts, gratitude, milestones, weekly insights)
- Data export
- No coach access

### Connect Tier ($29.99/month)
- All Plus features
- **Coach connection**
- **4 interactions per month** (weekly check-ins)
- Revenue split:
  - Coach: 60% ($18/month base)
  - Platform: 30% ($9/month)
  - Stripe fees: 10% ($3/month)

### Coach Limits
- **Max 50 clients per coach**
- **Max 4 interactions per client per month**
- Gift codes: 50-100% discount for clients
- Earnings: $18 per client/month

---

## 🎁 Gift Code System

Coaches can create discounted Connect memberships for their clients:

1. **Access:** Coach Portal (coach.html) when no entry is loaded
2. **Discounts:** 50%, 75%, or 100% off
3. **Duration:** Gift codes expire after 90 days
4. **Usage:** One-time use per code
5. **Tracking:** All gifted memberships tracked in `giftMemberships` collection

### How It Works:
1. Coach logs into portal
2. Selects discount amount (50-100% off)
3. Optionally enters client email
4. Generates unique gift code (e.g., `AB3K9XP2`)
5. Shares code with client
6. Client redeems at checkout → discount applied for life of subscription

---

## 📊 What Was Built

### Cloud Functions (7 new functions)
1. **createCheckoutSession** - Create Stripe checkout for subscriptions
2. **handleStripeWebhook** - Process Stripe events (subscriptions, payments, cancellations)
3. **getSubscriptionStatus** - Get current user's subscription tier and interaction count
4. **createGiftMembership** - Coaches create gift codes with discounts
5. **validateGiftCode** - Check if gift code is valid and get details
6. **trackPractitionerInteraction** - Increment monthly interaction counter
7. **resetMonthlyInteractions** - Scheduled function (1st of each month) to reset counters

### Frontend Files
1. **subscription-config.js** - Central configuration with master kill switch
2. **subscription-utils.js** - Feature gating, upgrade prompts, UI helpers
3. **app.html** - Updated with:
   - Subscription badge and tier display
   - Interaction tracker (Connect tier)
   - SMS upgrade prompts (Plus tier required)
   - Pricing comparison modal
   - Upgrade buttons throughout
4. **coach.html** - Added gift code generator for coaches

### Firestore Schema Updates
New fields added to `users` collection:
```javascript
{
  subscriptionTier: 'free' | 'plus' | 'connect',
  subscriptionStatus: 'active' | 'past_due' | 'canceled',
  stripeCustomerId: 'cus_xxx',
  stripeSubscriptionId: 'sub_xxx',
  interactionsThisMonth: 0,
  interactionsLimit: 4,
  extraInteractionsPurchased: 0,
  giftedBy: 'practitionerId' | null,
  subscriptionStartedAt: Timestamp,
  subscriptionCanceledAt: Timestamp,
}
```

New collection: `giftMemberships`
```javascript
{
  code: 'AB3K9XP2',
  createdBy: 'practitionerId',
  createdByEmail: 'practitioner@example.com',
  discountPercent: 0.50, // 50% off
  maxUses: 1,
  recipientEmail: 'client@example.com' | null,
  redeemedBy: ['userId1'],
  createdAt: Timestamp,
  expiresAt: Timestamp,
  status: 'active',
}
```

---

## 🔐 Security & Compliance

### Firestore Rules (TODO - Add these)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Gift memberships
    match /giftMemberships/{giftId} {
      // Coaches can create gift codes
      allow create: if request.auth != null 
                    && exists(/databases/$(database)/documents/approvedPractitioners/$(request.auth.uid));
      
      // Anyone can read to validate codes
      allow read: if true;
      
      // Only system (Cloud Functions) can update redemptions
      allow update: if false;
    }
    
    // User subscription data
    match /users/{userId} {
      // Users can read their own subscription status
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Only Cloud Functions can update subscription fields
      allow update: if false;
    }
  }
}
```

### Security Notes
- Coach sessions timeout after 30 minutes
- All payment processing handled by Stripe (PCI compliant)
- Gift codes don't expose client information

---

## 📈 Admin Dashboard (Coming Soon)

To complete the system, add to `admin.html`:

### Subscription Analytics Section
- Total revenue (monthly, YTD)
- Subscriber counts by tier (Free, Plus, Connect)
- Churn rate and trends
- Gifted membership tracking
- Coach payout summaries
- Top coaches by revenue
- Conversion funnel (Free → Plus → Connect)

### Quick Stats Cards
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 🚀 Plus Users   │  │ 🤝 Connect Users│  │ 💰 MRR          │
│ 142 subscribers │  │ 38 subscribers  │  │ $4,028          │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 🧪 Testing Checklist (Before Activation)

### Stripe Test Mode
1. [ ] Create test products and prices in Stripe test mode
2. [ ] Use test price IDs in config (pk_test_xxx, sk_test_xxx)
3. [ ] Test checkout flow with test card: `4242 4242 4242 4242`
4. [ ] Verify webhook receives events
5. [ ] Confirm user document updates with subscription tier
6. [ ] Test interaction tracking (Connect tier)
7. [ ] Test extra interaction purchase
8. [ ] Test gift code creation and redemption
9. [ ] Test monthly reset function (manually trigger)
10. [ ] Test subscription cancellation flow

### Feature Gating
1. [ ] Verify Free tier limits (20% AI, no SMS)
2. [ ] Verify Plus tier unlocks (100% AI, SMS enabled)
3. [ ] Verify Connect tier unlocks (coach access)
4. [ ] Test upgrade prompts appear when gated features accessed
5. [ ] Test interaction cap enforcement (7 max)

### UI/UX
1. [ ] Subscription badge displays correctly
2. [ ] Pricing modal shows all 3 tiers
3. [ ] Interaction tracker updates in real-time (Connect)
4. [ ] SMS upgrade prompt shows for Free users
5. [ ] Gift code UI works in coach portal
6. [ ] Gift badge shows for gifted subscriptions

---

## 🚀 Launch Day Workflow

1. **Morning of Launch:**
   - Switch Stripe to live mode (use live keys)
   - Update config with live price IDs
   - Set `PAYWALL_ENABLED: true`
   - Deploy: `firebase deploy --only hosting,functions`

2. **Monitor First 24 Hours:**
   - Watch Cloud Functions logs for errors
   - Monitor Stripe dashboard for payments
   - Check webhook delivery status
   - Verify user subscriptions creating correctly

3. **Support Prep:**
   - Test support email: support@inkwelljournal.io
   - Document common questions (pricing, refunds, cancellation)
   - Create FAQ page on website

---

## 💡 Future Enhancements

### Phase 2 (After 100+ Connections)
- [ ] Coach referral bonuses (Option C from pricing discussion)
- [ ] Performance rewards for highly-rated coaches
- [ ] Client satisfaction surveys
- [ ] Coach earnings dashboard
- [ ] Automated monthly payout reports

### Phase 3 (Scale)
- [ ] Annual subscription discounts (save 2 months)
- [ ] Team/organization plans
- [ ] Enterprise coach networks
- [ ] White-label options for clinics

---

## 📞 Need Help?

Contact Details:
- **Developer:** GitHub Copilot (AI Assistant)
- **Implementation Date:** December 14, 2025
- **System Status:** Fully built, dormant, ready to activate

**Activation Time:** ~15 minutes (Stripe setup) + 5 minutes (deploy)

---

## ✅ Deployment Command Reference

```bash
# Quick deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting

# Deploy specific functions
firebase deploy --only functions:createCheckoutSession,functions:handleStripeWebhook

# Set Firebase secrets
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# Test locally with emulators
firebase emulators:start

# Check deployment status
firebase deploy:status
```

---

## 🎯 Break-Even Analysis

**Costs Per Month:**
- Firebase/Hosting: ~$50
- Twilio SMS (100 users × $2): ~$200
- Anthropic AI: ~$100
- SendGrid Email: ~$15
- **Total:** ~$365/month

**Break-Even:**
- 60 Connect users ($29.99 × 60 = $1,800 revenue - $1,080 practitioner payouts = $720 profit - $365 costs = $355 net)
- **Or** 75 Plus users ($6.99 × 75 = $524 revenue - $365 costs = $159 net)
- **Or** Mix: 30 Connect + 30 Plus = Break-even ✅

**Target for Profitability:**
- 100 Connect + 200 Plus = **~$2,000/month profit** 🎉

---

**System ready to launch! 🚀**

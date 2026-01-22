# 🚀 InkWell Subscription System - Quick Reference

## Master Kill Switch Location
**File:** `public/subscription-config.js`  
**Line 7:** `PAYWALL_ENABLED: false` → Change to `true` to activate

---

## Revenue Model at a Glance

| Tier | Price | Features | Target User |
|------|-------|----------|-------------|
| **Free** | $0 | Journaling + 20% AI + Email recaps | Casual users, trial |
| **Plus** | $6.99/mo | + 100% AI + SMS notifications | Engaged journalers |
| **Connect** | $29.99/mo | + Coach (4 interactions/mo) | Coaching support |

---

## Coach Economics

### Per Client/Month:
- **Receives:** $18 base (60% of $29.99)
- **Max Clients:** 50
- **Max Earnings:** $900/month (50 clients × $18)

### Gift Codes:
- 50-100% discount
- One-time use
- 90-day expiration
- Discount applies for life of subscription

---

## Files Modified

### New Files Created:
1. `public/subscription-config.js` - Master configuration
2. `public/subscription-utils.js` - Feature gating & UI helpers
3. `SUBSCRIPTION-SYSTEM-GUIDE.md` - Full documentation

### Files Updated:
1. `functions/index.js` - Added 7 subscription functions
2. `functions/package.json` - Added Stripe dependency
3. `public/app.html` - Added subscription UI & gating
4. `public/coach.html` - Added gift code generator

---

## Cloud Functions Added

1. `createCheckoutSession` - Start Stripe checkout
2. `handleStripeWebhook` - Process Stripe events
3. `getSubscriptionStatus` - Get user tier/limits
4. `createGiftMembership` - Create coach gift code
5. `validateGiftCode` - Check gift code validity
6. `trackPractitionerInteraction` - Count interactions
7. `resetMonthlyInteractions` - Monthly reset (scheduled)

---

## Activation Checklist

### Before Launch:
- [ ] Create Stripe products (Plus, Connect)
- [ ] Update `subscription-config.js` with real price IDs
- [ ] Set Firebase secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Set up Stripe webhook endpoint
- [ ] Install Stripe package: `cd functions && npm install`
- [ ] Deploy functions: `firebase deploy --only functions`

### Launch Day:
- [ ] Set `PAYWALL_ENABLED: true` in config
- [ ] Set all `FEATURES` flags to `true`
- [ ] Deploy: `firebase deploy --only hosting`
- [ ] Test with real payment in Stripe live mode

### Post-Launch:
- [ ] Monitor Cloud Functions logs
- [ ] Watch Stripe dashboard
- [ ] Verify webhooks delivering successfully
- [ ] Check first user subscriptions

---

## Break-Even Points

**Monthly Costs:** ~$365  
**Break-Even Options:**
- 25 Connect users
- 50 Plus users  
- 15 Connect + 20 Plus users

**Target Profitability:**  
100 Plus + 50 Connect = **$2,500/month net profit**

---

## Testing Commands

```bash
# Test locally with emulators
firebase emulators:start

# Deploy to staging
firebase deploy --only hosting,functions

# Check deployment status
firebase deploy:status

# View function logs
firebase functions:log

# Test webhook
# Use Stripe CLI: stripe listen --forward-to localhost:5001/.../handleStripeWebhook
```

---

## Stripe Test Cards

**Successful Payment:** 4242 4242 4242 4242  
**Requires Authentication:** 4000 0025 0000 3155  
**Declined:** 4000 0000 0000 9995

**Test Mode Keys Start With:**
- Publishable: `pk_test_`
- Secret: `sk_test_`

**Live Mode Keys Start With:**
- Publishable: `pk_live_`
- Secret: `sk_live_`

---

## Support Resources

**Stripe Documentation:**
- Checkout: https://stripe.com/docs/payments/checkout
- Subscriptions: https://stripe.com/docs/billing/subscriptions
- Webhooks: https://stripe.com/docs/webhooks

**Firebase Documentation:**
- Cloud Functions: https://firebase.google.com/docs/functions
- Secrets: https://firebase.google.com/docs/functions/config-env#secret-manager

---

## Key Metrics to Track

### Revenue Metrics:
- Monthly Recurring Revenue (MRR)
- Average Revenue Per User (ARPU)
- Customer Lifetime Value (LTV)
- Churn rate

### User Metrics:
- Free → Plus conversion rate
- Plus → Connect conversion rate
- Gifted vs. paid Connect users

### Coach Metrics:
- Active coaches
- Clients per coach (average)
- Gift codes created vs. redeemed
- Monthly payout totals

---

## Quick Troubleshooting

**Webhook not working:**
- Check endpoint URL in Stripe dashboard
- Verify `STRIPE_WEBHOOK_SECRET` is set correctly
- Check Cloud Functions logs for errors

**Payment succeeds but user tier not updating:**
- Check webhook events in Stripe dashboard
- Verify `firebaseUID` in subscription metadata
- Check Firestore security rules allow updates

**Gift code not applying:**
- Verify code hasn't expired (90 days)
- Check if already redeemed (maxUses reached)
- Ensure coach who created it is approved

---

**🎯 System Status: Ready to Launch**

When you're ready to activate:
1. Update Stripe keys to live mode
2. Set `PAYWALL_ENABLED: true`
3. Deploy: `firebase deploy`
4. Monitor for 24 hours

**Estimated activation time: 20 minutes**

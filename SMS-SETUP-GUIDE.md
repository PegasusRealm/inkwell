# InkWell SMS Setup Guide

## ✅ Completed Frontend Changes

I've successfully implemented the following:

### 1. **Signup Modal** ✅
- Added phone number input field (optional)
- Added SMS opt-in checkbox (default: checked)
- Added phone validation with error display
- Format help text for users

### 2. **Settings Modal** ✅
- Added complete SMS Notifications section
- Phone number input with validation
- SMS opt-in toggle
- Granular SMS preferences:
  - 🌱 WISH milestone reminders
  - ✍️ Daily journal prompts
  - 💬 Coach replies
  - 📊 Weekly insights
- "Send Test SMS" button

### 3. **Data Handling** ✅
- Phone validation function (E.164 format)
- Updated signup to save phone + SMS preferences to Firestore
- Updated settings to load/save phone data
- Firestore structure includes:
  ```javascript
  {
    phoneNumber: "+15551234567",
    smsOptIn: true,
    smsPreferences: {
      wishMilestones: true,
      dailyPrompts: false,
      coachReplies: true,
      weeklyInsights: false
    }
  }
  ```

### 4. **Cloud Functions** ✅
- Created `functions/twilio-sms.js` with 5 SMS functions:
  - `sendTestSMS` - Test phone number
  - `sendWishMilestone` - WISH progress notifications
  - `sendDailyPrompt` - Daily journal prompts
  - `sendCoachReplyNotification` - Coach reply alerts
  - `sendSMS` - Generic SMS sending

---

## 🔧 Steps to Complete Setup

### Step 1: Install Twilio Package
```bash
cd functions
npm install twilio
```

### Step 2: Add Twilio Functions to index.js

**Open** `functions/index.js` and **append** the contents of `functions/twilio-sms.js` to the end of the file.

Alternatively, manually add these secret definitions near the top with the other secrets:
```javascript
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = defineSecret("TWILIO_PHONE_NUMBER");
```

Then add the 5 exported functions at the end of the file.

### Step 3: Configure Firebase Secrets

Run these commands in your terminal (from the project root):

```bash
# Set Twilio Account SID
firebase functions:secrets:set TWILIO_ACCOUNT_SID
# Paste: PN749e686abb5fd91a1a2c9f70d5d01bbd

# Set Twilio Auth Token
firebase functions:secrets:set TWILIO_AUTH_TOKEN
# Paste: 29e68d22eecafd5f3414ba47c4e98f61

# Set Twilio Phone Number
firebase functions:secrets:set TWILIO_PHONE_NUMBER
# Paste: +18888588064
```

**Note:** The system will prompt you to paste each value after running each command.

### Step 4: Deploy Functions

```bash
firebase deploy --only functions
```

This will deploy:
- `sendTestSMS`
- `sendWishMilestone`
- `sendDailyPrompt`
- `sendCoachReplyNotification`
- `sendSMS`

### Step 5: Deploy Frontend Changes

Your frontend changes are already in place! Just deploy:

```bash
firebase deploy --only hosting
```

Or if using Firebase hosting auto-deploy, just commit and push your changes.

---

## 🧪 Testing

### Test 1: New Signup with Phone
1. Sign up with a new account
2. Enter phone number: `+15551234567` (or your real number)
3. Check SMS opt-in checkbox
4. Complete signup
5. Check Firestore - user document should have `phoneNumber` and `smsOptIn` fields

### Test 2: Settings Phone Management
1. Log into existing account
2. Go to Settings (⚙️)
3. Scroll to "SMS Notifications" section
4. Enter phone number
5. Check/uncheck SMS preferences
6. Click "Send Test SMS"
7. Check your phone for test message

### Test 3: Phone Validation
1. Try entering invalid formats:
   - `555-123-4567` (missing +1)
   - `(555) 123-4567` (missing +1)
   - `15551234567` (missing +)
2. Should show error message
3. Try valid format: `+15551234567`
4. Should accept and save

---

## 📱 SMS Functions Usage Examples

### From Frontend (app.html)

```javascript
// Send test SMS
const sendTestSMS = firebase.functions().httpsCallable('sendTestSMS');
await sendTestSMS({ phoneNumber: '+15551234567' });

// Send WISH milestone
const sendWishMilestone = firebase.functions().httpsCallable('sendWishMilestone');
await sendWishMilestone({
  phoneNumber: '+15551234567',
  milestone: 'half', // 'quarter', 'half', 'three-quarters', 'complete'
  daysElapsed: 45,
  totalDays: 90
});

// Send daily prompt
const sendDailyPrompt = firebase.functions().httpsCallable('sendDailyPrompt');
await sendDailyPrompt({
  phoneNumber: '+15551234567',
  prompt: 'What are you grateful for today?' // Optional custom prompt
});

// Send coach reply notification
const sendCoachReplyNotification = firebase.functions().httpsCallable('sendCoachReplyNotification');
await sendCoachReplyNotification({
  phoneNumber: '+15551234567',
  coachName: 'Dr. Smith' // Optional
});

// Send generic SMS
const sendSMS = firebase.functions().httpsCallable('sendSMS');
await sendSMS({
  phoneNumber: '+15551234567',
  message: 'Your custom message here'
});
```

---

## 🔒 Security Notes

✅ **What's Protected:**
- All SMS functions require authentication (`request.auth`)
- Phone numbers validated before sending
- Twilio credentials stored as Firebase secrets (never in code)
- User can only send to their own verified phone number

⚠️ **Rate Limiting (TODO):**
Consider adding rate limiting to prevent SMS spam:
- Max 1 test SMS per minute
- Max 10 SMS per user per day

---

## 💰 Cost Monitoring

**Twilio Pricing:**
- Phone Number: ~$1.00/month
- SMS (US): ~$0.0079 per message
- SMS (International): varies by country

**Estimated Costs:**
- 100 users × 4 SMS/month = 400 SMS = ~$3.20/month
- 1,000 users × 4 SMS/month = 4,000 SMS = ~$32/month

**Monitor in Twilio Dashboard:**
https://console.twilio.com/

---

## 🐛 Troubleshooting

### "reCAPTCHA error" during signup
- reCAPTCHA keys are already configured
- This shouldn't affect SMS functionality

### "Function not found: sendTestSMS"
- Make sure you deployed functions: `firebase deploy --only functions`
- Check Firebase Console → Functions to verify they're deployed

### "Invalid phone number" error
- Phone must be in E.164 format: `+[country code][number]`
- US example: `+15551234567`
- No spaces, dashes, or parentheses in stored format

### SMS not received
- Check Twilio console for delivery status
- Trial accounts can only send to verified numbers
- Check user's `smsOptIn` is `true` in Firestore
- Verify phone number is correct in Firestore

### Test SMS button does nothing
- Open browser console (F12) to see errors
- Verify user is logged in
- Check that phone number is entered in settings

---

## ✨ Next Steps (Future Enhancements)

1. **Automated WISH Milestones**
   - Create scheduled function to check user WISH progress daily
   - Auto-send milestone SMS when thresholds reached

2. **Daily Prompt Scheduler**
   - Schedule SMS prompts at user-preferred time
   - Store timezone preference in user document

3. **Coach Reply Trigger**
   - Add Firestore trigger on coach replies
   - Auto-send SMS notification to journaler

4. **SMS Reply Handling**
   - Implement webhook to handle STOP/START replies
   - Update `smsOptIn` when user texts STOP

5. **Usage Analytics**
   - Track SMS delivery rates
   - Monitor opt-out rates
   - A/B test message content

---

## 📋 Summary

**What You Need to Do:**
1. ✅ Install Twilio: `cd functions && npm install twilio`
2. ✅ Copy code from `functions/twilio-sms.js` to end of `functions/index.js`
3. ✅ Set Firebase secrets (3 commands shown above)
4. ✅ Deploy functions: `firebase deploy --only functions`
5. ✅ Test with "Send Test SMS" button in settings

**What's Already Done:**
- ✅ Frontend UI (signup + settings)
- ✅ Phone validation
- ✅ Firestore data structure
- ✅ Cloud Functions code
- ✅ SMS function examples

**Your Twilio Credentials:**
- Account SID: `PN749e686abb5fd91a1a2c9f70d5d01bbd`
- Auth Token: `29e68d22eecafd5f3414ba47c4e98f61`
- Phone Number: `+18888588064`

Let me know when you've completed the steps and we can test it together! 🚀

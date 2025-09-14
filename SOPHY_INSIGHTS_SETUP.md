# 📊 Sophy's Weekly & Monthly Insights Setup

## ✅ What's Implemented

### 1. **Settings UI**
- Added beautiful opt-in checkboxes in User Settings modal
- Weekly Insights: Every Monday morning
- Monthly Insights: First Monday of each month
- Users can enable/disable each separately

### 2. **Database Integration**  
- Insights preferences saved to Firestore `users` collection
- Auto-loads user preferences when settings modal opens
- Preferences stored under `insightsPreferences` field

### 3. **Cloud Functions**
- `sendWeeklyInsights` - Processes all users with weekly insights enabled
- `sendMonthlyInsights` - Processes all users with monthly insights enabled  
- Anthropic Claude integration for intelligent analysis
- SendGrid email delivery with beautiful HTML templates

### 4. **Data Analysis**
- Analyzes journal entries and manifest entries for specified period
- Calculates engagement stats (days active, word count, entry count)
- Uses gestalt and positive psychology principles
- Identifies mood patterns and growth themes

## 🚀 To Enable Automated Scheduling

### Option 1: Google Cloud Scheduler (Recommended)
```bash
# Weekly insights - Every Monday at 9 AM UTC  
gcloud scheduler jobs create http weekly-insights \
  --schedule="0 9 * * 1" \
  --uri="https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/sendWeeklyInsights" \
  --http-method=POST \
  --time-zone="UTC"

# Monthly insights - First Monday of each month at 9 AM UTC
gcloud scheduler jobs create http monthly-insights \
  --schedule="0 9 1-7 * 1" \
  --uri="https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/sendMonthlyInsights" \
  --http-method=POST \
  --time-zone="UTC"
```

### Option 2: Firebase Extensions
Install the **Firebase Scheduled Functions** extension for easier management.

### Option 3: External Cron Service
Use services like cron-job.org or GitHub Actions to trigger the functions.

## 🧪 Testing

### Manual Trigger (for testing):
```bash
# Test weekly insights
curl -X POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/sendWeeklyInsights

# Test monthly insights  
curl -X POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/sendMonthlyInsights
```

### Test with Sample Users:
1. Enable insights in your user settings
2. Create some journal/manifest entries
3. Manually trigger the function
4. Check your email for Sophy's insights!

## 📧 Email Features

### From: `sophy@inkwelljournal.io`
- Beautiful gradient design matching InkWell theme
- Personalized content based on actual user data
- Plain text fallback for accessibility
- Unsubscribe/preference management links

### Content Analysis:
- **Mood Patterns**: Identifies emotional themes across entries
- **Growth Themes**: Recognizes progress and positive changes  
- **Engagement Insights**: Celebrates consistency and commitment
- **Gentle Guidance**: Offers supportive observations without being prescriptive
- **Personal Touch**: Uses actual entry content for genuine insights

## 🔐 Privacy & Security

- Only users who explicitly opt-in receive insights
- Entry content is truncated to essential parts for analysis
- All data processing happens server-side with secure API calls
- Users can disable insights anytime in settings

## 📊 Sample Insight Email

```
Hi Sarah! ✨

I've been reflecting on your beautiful week of journaling, and I'm genuinely moved by your commitment to self-discovery. Your 5 entries across 4 days show such intentionality.

I noticed a lovely thread of gratitude weaving through your reflections - especially your appreciation for small moments like morning coffee and evening walks. There's something powerful about how you're learning to find joy in the everyday.

Your recent entries also show you're navigating some work transitions with remarkable self-awareness. The way you wrote about "choosing growth over comfort" on Tuesday really resonated - you're developing such wisdom about your own journey.

What strikes me most is how your writing style itself has evolved. Earlier entries felt more questioning, but lately there's a groundedness, like you're trusting yourself more deeply.

Keep nurturing this beautiful practice. Your words are creating a path toward the person you're becoming.

With warmth,
Sophy 💙
```

## 🎯 Beta Launch Ready!

This feature adds significant value to InkWell:
- **Differentiation**: Unique AI-powered insights feature
- **Engagement**: Encourages consistent journaling
- **Retention**: Creates ongoing value touchpoints  
- **Premium Feel**: Advanced analytics and personalization

Users will love getting these thoughtful, personalized reflections from Sophy! 🌟

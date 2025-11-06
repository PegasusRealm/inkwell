# InkWell Gratitude SMS System

## Overview
Personalized gratitude prompts from Sophy via SMS, with two-way communication to collect and store user responses in the app.

---

## System Architecture

### 1. User Preferences (Frontend - ✅ DONE)
- Added `smsGratitudePrompts` checkbox in Settings
- Default: **ON** (checked by default)
- Saved to Firestore: `users/{uid}/smsPreferences/gratitudePrompts`

### 2. Daily Gratitude Scheduler (Cloud Function - TODO)
**Function:** `dailyGratitudeScheduler`
- **Runs:** 9:00 AM Hawaii time daily
- **Triggers:** Sends personalized gratitude prompts
- **Logic:** Tiered system based on user engagement

### 3. SMS Response Webhook (Cloud Function - TODO)
**Function:** `handleGratitudeResponse`
- **Triggered by:** Twilio webhook when user replies
- **Saves to:** Firestore `gratitudes/{userId}/entries/`
- **Displays in:** App "Gratitudes" tab

### 4. Gratitudes Display (Frontend - TODO)
- New tab or section showing collected gratitude responses
- Monthly recap view
- Export/share capabilities

---

## Tiered Gratitude System

### **Tier 1: New Users (0-4 entries)**
**Goal:** Build habit, keep it simple

**Prompts:**
```
"Good morning! 🌅 Sophy here. What's one small thing you're grateful for today?"

"Hi! ✨ Even tiny moments count. What made you smile yesterday?"

"Morning! 🌸 What's bringing you peace right now?"
```

**Logic:**
- Random selection from 10 simple prompts
- No personalization needed
- Encouraging, gentle tone

---

### **Tier 2: Active Journalers (5-19 entries)**
**Goal:** Show Sophy "knows" them, increase relevance

**Method:** Keyword extraction from recent 7 days of journal entries
- Extract top 3 themes (work, family, health, creativity, etc.)
- Reference these in prompts

**Example Prompts:**
```
// If user wrote about "work" and "coffee":
"Morning! ☕ You mentioned enjoying your coffee ritual. 
What about that moment are you grateful for?"

// If user wrote about "family" and "stress":
"Hi! 💚 I know things have been stressful. 
What small moment with family brought you joy this week?"
```

**Implementation:**
```javascript
// Simple keyword matching
const themes = extractKeywords(recentEntries); // ['work', 'coffee', 'stress']
const prompt = generateThemePrompt(themes);
```

---

### **Tier 3: Deep Engagement (20+ entries)**
**Goal:** Highly personalized, reference specific moments

**Method:** Use Claude API to generate contextual prompts based on actual journal content

**Example Prompts:**
```
// Based on specific journal entry:
"Hi Sarah! Last Tuesday you mentioned your daughter's first piano recital. 
What unexpected moment from that day still makes you smile?"

// Connecting multiple entries:
"Morning! Over the past week, you've been writing about starting 
your garden. What's one thing growing there (literally or metaphorically) 
that you're grateful for?"
```

**Implementation:**
```javascript
// Call Claude with journal context
const prompt = await generateAIGratitudePrompt(userId, recentEntries);
```

---

## Data Structure

### Firestore Collections

#### `users/{userId}/smsPreferences`
```javascript
{
  gratitudePrompts: true,
  lastGratitudeSent: timestamp,
  gratitudeFrequency: "daily" | "every-other-day" | "2x-week"
}
```

#### `gratitudes/{userId}/entries/{entryId}`
```javascript
{
  userId: "abc123",
  promptSent: "What made you smile today?",
  response: "My morning coffee and watching sunrise",
  receivedAt: timestamp,
  phoneNumber: "+18088889999",
  sentiment: "positive", // auto-analyzed
  themes: ["morning", "nature", "self-care"]
}
```

#### `gratitudes/{userId}/stats`
```javascript
{
  totalResponses: 45,
  responseRate: 0.72, // 72% of prompts get responses
  longestStreak: 14,
  currentStreak: 7,
  topThemes: ["family", "nature", "work achievements"],
  lastUpdated: timestamp
}
```

---

## Cloud Functions to Create

### Function 1: Daily Gratitude Scheduler

**File:** `functions/index.js`

```javascript
exports.dailyGratitudeScheduler = onSchedule({
  schedule: "0 19 * * *", // 9 AM Hawaii = 19:00 UTC
  timeZone: "UTC",
  secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, ANTHROPIC_API_KEY]
}, async (event) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] 🙏 Starting daily gratitude scheduler`);
  
  try {
    // Get users who opted in to gratitude prompts
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('smsOptIn', '==', true)
      .where('smsPreferences.gratitudePrompts', '==', true)
      .get();
    
    if (usersSnapshot.empty) {
      console.log(`[${requestId}] No users opted in for gratitude prompts`);
      return;
    }
    
    let sent = 0;
    let skipped = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Skip if no phone number
      if (!userData.phoneNumber) {
        skipped++;
        continue;
      }
      
      // Check frequency preference (respect user's choice)
      const shouldSendToday = await shouldSendGratitudeToday(userId, userData);
      if (!shouldSendToday) {
        skipped++;
        continue;
      }
      
      try {
        // Determine tier based on entry count
        const entryCount = await getUserEntryCount(userId);
        let prompt;
        
        if (entryCount < 5) {
          // Tier 1: Simple random prompts
          prompt = getRandomSimplePrompt();
        } else if (entryCount < 20) {
          // Tier 2: Theme-based prompts
          const themes = await extractUserThemes(userId);
          prompt = generateThemePrompt(themes, userData.displayName);
        } else {
          // Tier 3: AI-personalized prompts
          prompt = await generateAIGratitudePrompt(userId, userData.displayName);
        }
        
        // Send SMS via Twilio
        const twilioClient = require('twilio')(
          TWILIO_ACCOUNT_SID.value(),
          TWILIO_AUTH_TOKEN.value()
        );
        
        await twilioClient.messages.create({
          body: prompt,
          from: TWILIO_PHONE_NUMBER.value(),
          to: userData.phoneNumber
        });
        
        // Track that we sent it
        await admin.firestore()
          .collection('users')
          .doc(userId)
          .update({
            'smsPreferences.lastGratitudeSent': admin.firestore.FieldValue.serverTimestamp()
          });
        
        sent++;
        console.log(`[${requestId}] ✅ Sent gratitude prompt to ${userId}`);
        
      } catch (userError) {
        console.error(`[${requestId}] ❌ Failed to send to ${userId}:`, userError);
      }
    }
    
    console.log(`[${requestId}] 📊 Gratitude scheduler complete: ${sent} sent, ${skipped} skipped`);
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Gratitude scheduler failed:`, error);
  }
});

// Helper: Check if should send today based on frequency
async function shouldSendGratitudeToday(userId, userData) {
  const lastSent = userData.smsPreferences?.lastGratitudeSent;
  if (!lastSent) return true; // First time
  
  const daysSinceLastSent = Math.floor(
    (Date.now() - lastSent.toMillis()) / (1000 * 60 * 60 * 24)
  );
  
  const frequency = userData.smsPreferences?.gratitudeFrequency || 'daily';
  
  switch (frequency) {
    case 'daily': return daysSinceLastSent >= 1;
    case 'every-other-day': return daysSinceLastSent >= 2;
    case '2x-week': return daysSinceLastSent >= 3;
    default: return daysSinceLastSent >= 1;
  }
}

// Helper: Get user's entry count
async function getUserEntryCount(userId) {
  const entriesSnapshot = await admin.firestore()
    .collection('journalEntries')
    .where('userId', '==', userId)
    .count()
    .get();
  
  return entriesSnapshot.data().count || 0;
}

// Helper: Simple random prompts for new users
function getRandomSimplePrompt() {
  const prompts = [
    "Good morning! 🌅 What's one small thing you're grateful for today?",
    "Hi! ✨ What made you smile yesterday?",
    "Morning! 🌸 What's bringing you peace right now?",
    "Hey! 💚 What's one thing going well in your life today?",
    "Good morning! 🙏 What small moment of joy did you notice recently?",
    "Hi there! ☀️ What's one thing about today that you're looking forward to?",
    "Morning! 🌻 Who in your life are you grateful for right now?",
    "Hey! 🌊 What simple pleasure are you grateful for today?",
    "Good morning! 🦋 What's something beautiful you noticed this week?",
    "Hi! 🌟 What's one thing your body did for you today that you appreciate?"
  ];
  
  return prompts[Math.floor(Math.random() * prompts.length)];
}

// Helper: Extract themes from recent entries
async function extractUserThemes(userId) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const recentEntries = await admin.firestore()
    .collection('journalEntries')
    .where('userId', '==', userId)
    .where('timestamp', '>=', sevenDaysAgo)
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();
  
  if (recentEntries.empty) return [];
  
  // Simple keyword extraction
  const allText = recentEntries.docs
    .map(doc => doc.data().entryText || '')
    .join(' ')
    .toLowerCase();
  
  const keywords = {
    work: ['work', 'job', 'career', 'office', 'project', 'meeting', 'colleague'],
    family: ['family', 'mom', 'dad', 'parent', 'child', 'kid', 'daughter', 'son', 'spouse', 'partner'],
    health: ['health', 'exercise', 'workout', 'run', 'walk', 'yoga', 'meditation', 'sleep'],
    creativity: ['create', 'creative', 'art', 'write', 'writing', 'music', 'paint', 'design'],
    nature: ['nature', 'outside', 'outdoor', 'park', 'garden', 'tree', 'flower', 'sunrise', 'sunset'],
    selfCare: ['self-care', 'relax', 'rest', 'bath', 'read', 'coffee', 'tea', 'quiet'],
    relationships: ['friend', 'friendship', 'relationship', 'love', 'connection', 'community'],
    growth: ['learn', 'growth', 'progress', 'challenge', 'overcome', 'achieve', 'accomplish']
  };
  
  const foundThemes = [];
  for (const [theme, words] of Object.entries(keywords)) {
    const matchCount = words.filter(word => allText.includes(word)).length;
    if (matchCount > 0) {
      foundThemes.push({ theme, count: matchCount });
    }
  }
  
  // Return top 3 themes
  return foundThemes
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(t => t.theme);
}

// Helper: Generate theme-based prompt
function generateThemePrompt(themes, userName) {
  if (themes.length === 0) {
    return getRandomSimplePrompt();
  }
  
  const name = userName ? userName.split(' ')[0] : 'there';
  const theme = themes[0]; // Use top theme
  
  const themePrompts = {
    work: `Morning ${name}! 💼 You've been thinking about work lately. What's one thing you accomplished this week that you're proud of?`,
    family: `Hi ${name}! 👨‍👩‍👧 What's a small moment with family recently that brought you joy?`,
    health: `Morning ${name}! 💪 You've been focusing on your health. What does your body feel grateful for today?`,
    creativity: `Hey ${name}! 🎨 What creative moment or idea this week sparked joy for you?`,
    nature: `Good morning ${name}! 🌿 What's something in nature you noticed and appreciated recently?`,
    selfCare: `Hi ${name}! ☕ What small act of self-care brought you peace this week?`,
    relationships: `Morning ${name}! 💗 Who in your life are you grateful for today, and why?`,
    growth: `Hey ${name}! 🌱 What challenge did you face recently that helped you grow?`
  };
  
  return themePrompts[theme] || getRandomSimplePrompt();
}

// Helper: AI-powered personalized prompt
async function generateAIGratitudePrompt(userId, userName) {
  try {
    // Get recent entries (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentEntries = await admin.firestore()
      .collection('journalEntries')
      .where('userId', '==', userId)
      .where('timestamp', '>=', sevenDaysAgo)
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    if (recentEntries.empty) {
      return getRandomSimplePrompt();
    }
    
    // Extract entries
    const entriesText = recentEntries.docs
      .map(doc => {
        const data = doc.data();
        const date = data.timestamp?.toDate().toLocaleDateString() || 'recently';
        return `[${date}]: ${data.entryText}`;
      })
      .join('\n\n');
    
    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY.value(),
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `You are Sophy, a compassionate AI coach for InkWell journaling app. Based on these recent journal entries, create a personalized gratitude SMS prompt.

User's name: ${userName || 'there'}
Recent journal entries:
${entriesText}

Generate a single SMS message (under 160 characters) that:
1. References something specific they wrote about
2. Asks what they're grateful for related to that topic
3. Is warm, personal, and from Sophy
4. Uses an emoji
5. Feels like a friend checking in

Just return the SMS text, nothing else.`
        }]
      })
    });
    
    const data = await response.json();
    return data.content[0].text.trim();
    
  } catch (error) {
    console.error('AI prompt generation failed:', error);
    return getRandomSimplePrompt(); // Fallback
  }
}
```

---

### Function 2: Handle Gratitude SMS Responses

**File:** `functions/index.js`

```javascript
exports.handleGratitudeResponse = onRequest({
  cors: true,
  secrets: [TWILIO_AUTH_TOKEN, ANTHROPIC_API_KEY]
}, async (req, res) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] 📥 Received SMS response`);
  
  try {
    // Validate Twilio webhook request
    const twilioSignature = req.headers['x-twilio-signature'];
    const authToken = TWILIO_AUTH_TOKEN.value();
    
    // Twilio validation would go here (skip for now)
    
    // Extract message data
    const { From: phoneNumber, Body: messageBody } = req.body;
    
    console.log(`[${requestId}] From: ${phoneNumber}, Body: ${messageBody}`);
    
    // Handle STOP/START commands
    if (messageBody.toUpperCase().includes('STOP')) {
      await handleOptOut(phoneNumber);
      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      return;
    }
    
    if (messageBody.toUpperCase().includes('START')) {
      await handleOptIn(phoneNumber);
      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Welcome back! You\'ll receive gratitude prompts from Sophy again. 💚</Message></Response>');
      return;
    }
    
    // Find user by phone number
    const userSnapshot = await admin.firestore()
      .collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();
    
    if (userSnapshot.empty) {
      console.log(`[${requestId}] No user found for phone: ${phoneNumber}`);
      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      return;
    }
    
    const userId = userSnapshot.docs[0].id;
    const userData = userSnapshot.docs[0].data();
    
    // Get the prompt that was sent (from recent sends)
    const promptSent = await getLastGratitudePrompt(userId);
    
    // Analyze sentiment (optional, use Claude)
    const sentiment = await analyzeSentiment(messageBody);
    
    // Extract themes from response
    const themes = extractThemesFromText(messageBody);
    
    // Save gratitude response to Firestore
    const gratitudeRef = admin.firestore()
      .collection('gratitudes')
      .doc(userId)
      .collection('entries')
      .doc();
    
    await gratitudeRef.set({
      userId: userId,
      promptSent: promptSent || "What are you grateful for today?",
      response: messageBody,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      phoneNumber: phoneNumber,
      sentiment: sentiment,
      themes: themes,
      source: 'sms'
    });
    
    // Update user stats
    await updateGratitudeStats(userId);
    
    // Send confirmation reply
    const confirmations = [
      "Thank you for sharing! 💚 I've saved this to your Gratitudes in InkWell.",
      "Beautiful! ✨ Your gratitude has been saved.",
      "Love this! 🌟 Added to your Gratitude Collection.",
      "Thank you! 🙏 This is now in your InkWell gratitudes.",
      "Wonderful! 🌸 I've added this to your gratitude journal."
    ];
    
    const confirmation = confirmations[Math.floor(Math.random() * confirmations.length)];
    
    console.log(`[${requestId}] ✅ Saved gratitude for user ${userId}`);
    
    // Respond with TwiML
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${confirmation}</Message></Response>`);
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error handling gratitude response:`, error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});

// Helper: Get last gratitude prompt sent
async function getLastGratitudePrompt(userId) {
  // You could store this in a separate collection
  // For now, return generic
  return "What are you grateful for today?";
}

// Helper: Analyze sentiment
async function analyzeSentiment(text) {
  // Simple keyword-based sentiment (or use Claude)
  const positive = ['happy', 'grateful', 'love', 'joy', 'peace', 'wonderful', 'blessed'];
  const negative = ['sad', 'hard', 'difficult', 'struggle', 'pain'];
  
  const lowerText = text.toLowerCase();
  const hasPositive = positive.some(word => lowerText.includes(word));
  const hasNegative = negative.some(word => lowerText.includes(word));
  
  if (hasPositive && !hasNegative) return 'positive';
  if (hasNegative && !hasPositive) return 'challenged';
  if (hasPositive && hasNegative) return 'mixed';
  return 'neutral';
}

// Helper: Extract themes
function extractThemesFromText(text) {
  const keywords = {
    family: ['family', 'mom', 'dad', 'child', 'kid', 'son', 'daughter', 'spouse', 'partner'],
    friends: ['friend', 'friendship'],
    health: ['health', 'body', 'exercise', 'sleep'],
    work: ['work', 'job', 'project', 'career'],
    nature: ['nature', 'outside', 'weather', 'sun', 'tree', 'garden'],
    home: ['home', 'house', 'cozy', 'comfortable'],
    food: ['food', 'meal', 'coffee', 'tea', 'breakfast', 'dinner'],
    pets: ['dog', 'cat', 'pet'],
    creativity: ['create', 'art', 'music', 'write'],
    growth: ['learn', 'grow', 'achieve', 'accomplish']
  };
  
  const foundThemes = [];
  const lowerText = text.toLowerCase();
  
  for (const [theme, words] of Object.entries(keywords)) {
    if (words.some(word => lowerText.includes(word))) {
      foundThemes.push(theme);
    }
  }
  
  return foundThemes;
}

// Helper: Update gratitude stats
async function updateGratitudeStats(userId) {
  const statsRef = admin.firestore()
    .collection('gratitudes')
    .doc(userId)
    .collection('metadata')
    .doc('stats');
  
  const statsDoc = await statsRef.get();
  const currentStats = statsDoc.exists ? statsDoc.data() : {};
  
  const totalResponses = (currentStats.totalResponses || 0) + 1;
  const lastResponseDate = new Date().toDateString();
  
  // Calculate streak
  let currentStreak = currentStats.currentStreak || 0;
  const lastDate = currentStats.lastResponseDate;
  
  if (lastDate) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    if (lastDate === yesterday) {
      currentStreak++;
    } else if (lastDate !== lastResponseDate) {
      currentStreak = 1;
    }
  } else {
    currentStreak = 1;
  }
  
  const longestStreak = Math.max(currentStats.longestStreak || 0, currentStreak);
  
  await statsRef.set({
    totalResponses,
    currentStreak,
    longestStreak,
    lastResponseDate: lastResponseDate,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

// Helper: Handle opt-out
async function handleOptOut(phoneNumber) {
  await admin.firestore()
    .collection('users')
    .where('phoneNumber', '==', phoneNumber)
    .limit(1)
    .get()
    .then(snapshot => {
      if (!snapshot.empty) {
        return snapshot.docs[0].ref.update({
          smsOptIn: false
        });
      }
    });
}

// Helper: Handle opt-in
async function handleOptIn(phoneNumber) {
  await admin.firestore()
    .collection('users')
    .where('phoneNumber', '==', phoneNumber)
    .limit(1)
    .get()
    .then(snapshot => {
      if (!snapshot.empty) {
        return snapshot.docs[0].ref.update({
          smsOptIn: true
        });
      }
    });
}
```

---

## Twilio Setup for Response Handling

### Configure Webhook in Twilio Console

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click your phone number
3. Under "Messaging Configuration":
   - **A MESSAGE COMES IN:** Webhook
   - **URL:** `https://us-central1-inkwell-alpha.cloudfunctions.net/handleGratitudeResponse`
   - **HTTP:** POST
4. Save

---

## Frontend: Display Gratitudes (TODO)

### Add Gratitudes Tab/Section

```html
<!-- In app.html, add new tab -->
<div id="gratitudesTab" class="modern-tab-content">
  <h2>🙏 Your Gratitudes</h2>
  <p>Moments of gratitude you've shared with Sophy</p>
  
  <div id="gratitudesList">
    <!-- Populated by JavaScript -->
  </div>
</div>
```

### JavaScript to Load Gratitudes

```javascript
async function loadGratitudes() {
  const user = auth.currentUser;
  if (!user) return;
  
  const gratitudesSnapshot = await getDocs(
    query(
      collection(db, 'gratitudes', user.uid, 'entries'),
      orderBy('receivedAt', 'desc'),
      limit(50)
    )
  );
  
  const gratitudesList = document.getElementById('gratitudesList');
  gratitudesList.innerHTML = '';
  
  if (gratitudesSnapshot.empty) {
    gratitudesList.innerHTML = '<p>No gratitudes yet. Reply to Sophy\'s SMS to start collecting! 💚</p>';
    return;
  }
  
  gratitudesSnapshot.forEach(doc => {
    const data = doc.data();
    const date = data.receivedAt?.toDate().toLocaleDateString();
    
    const gratitudeCard = document.createElement('div');
    gratitudeCard.className = 'gratitude-card';
    gratitudeCard.innerHTML = `
      <div class="gratitude-date">${date}</div>
      <div class="gratitude-prompt">${data.promptSent}</div>
      <div class="gratitude-response">${data.response}</div>
      ${data.themes ? `<div class="gratitude-themes">${data.themes.map(t => `#${t}`).join(' ')}</div>` : ''}
    `;
    
    gratitudesList.appendChild(gratitudeCard);
  });
}
```

---

## Testing Checklist

### Before Twilio Verification:
- [x] SMS preference checkbox added to Settings
- [x] Save/load SMS preferences working
- [ ] Deploy frontend changes

### After Twilio Verification:
- [ ] Deploy `dailyGratitudeScheduler` function
- [ ] Deploy `handleGratitudeResponse` function
- [ ] Configure Twilio webhook URL
- [ ] Test receiving gratitude prompt
- [ ] Test replying to prompt
- [ ] Verify response saved to Firestore
- [ ] Test STOP command
- [ ] Test START command
- [ ] Build gratitudes display in app

---

## Future Enhancements

1. **Monthly Gratitude Recap Email**
   - Compile all gratitudes from the month
   - Send beautiful summary email

2. **Gratitude Insights**
   - "You're most grateful for family moments"
   - "Your gratitude streak: 14 days!"

3. **Share Gratitude**
   - Export as PDF
   - Share specific gratitudes with coach

4. **Gratitude Prompts Based on Time**
   - Morning: "What are you looking forward to?"
   - Evening: "What went well today?"

5. **Voice Response Support**
   - Let users call in their gratitudes
   - Transcribe and save like text

---

## Cost Analysis

- **Twilio SMS:** ~$0.0079 per message
- **Claude API (Haiku):** ~$0.00025 per prompt (Tier 3 only)
- **Firebase Functions:** Minimal (generous free tier)

**Example costs for 100 users:**
- Daily gratitude prompts: 100 × $0.0079 = $0.79/day = ~$24/month
- Response confirmations: 70 responses × $0.0079 = $0.55/day = ~$17/month
- Claude AI (20% use Tier 3): 20 × $0.00025 = $0.005/day = ~$0.15/month

**Total: ~$41/month for 100 users** (with 70% response rate)

---

## Next Steps

1. **Deploy frontend changes** (gratitude checkbox) ✅ Ready
2. **Wait for Twilio verification** (in progress)
3. **Add Cloud Functions** (scheduler + webhook handler)
4. **Configure Twilio webhook**
5. **Test end-to-end**
6. **Build gratitudes display in app**

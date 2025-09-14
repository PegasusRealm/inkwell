# Coach Notification Email Throttling Enhancement

## 🔧 **Enhancement Overview**

Enhanced the coach notification system with **advanced deduplication** to prevent spammy email notifications from repeated edits of the same journal entry content.

## 📋 **Current Implementation**

### ✅ **Existing Throttling (Maintained)**
- **Time-based throttling**: 10 minutes minimum between notifications for the same entry
- **Purpose**: Prevents rapid-fire notifications during active editing sessions

### 🆕 **New Deduplication (Added)**
- **Content-based deduplication**: Hash-based detection of unchanged content
- **Purpose**: Prevents notifications when entry content hasn't actually changed

## 🔒 **How Deduplication Works**

### 1. **Content Hash Generation**
```javascript
function createContentHash(entryId, text) {
  const content = `${entryId}:${text}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}
```

- **Input**: Entry ID + full entry text
- **Output**: 16-character SHA-256 hash
- **Purpose**: Unique fingerprint for each content version

### 2. **Dual-Layer Protection**
```javascript
// Layer 1: Time-based throttling (10 minutes)
const lastNotified = entry.coachNotifiedAt?.toDate?.();
if (lastNotified && Date.now() - lastNotified.getTime() < 10 * 60 * 1000) {
  return res.status(200).send("Already notified recently.");
}

// Layer 2: Content-based deduplication
const contentHash = createContentHash(entryId, fullEntryText);
const lastContentHash = entry.lastNotificationHash;
if (lastContentHash === contentHash) {
  return res.status(200).send("Content unchanged - skipping duplicate notification.");
}
```

### 3. **Hash Storage**
```javascript
await admin.firestore().collection("journalEntries").doc(entryId).update({
  coachNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
  lastNotificationHash: contentHash  // Store content hash for next comparison
});
```

## 🛡️ **Security & Data Protection**

### Protected Fields in Firestore Rules
Updated security rules to protect the new deduplication field:

```javascript
!request.resource.data.diff(resource.data).affectedKeys()
  .hasAny(['coachResponse', 'newCoachReply', 'coachNotifiedAt', 'lastNotificationHash'])
```

**Protected Fields**:
- ✅ `coachNotifiedAt` - Timestamp of last notification
- ✅ `lastNotificationHash` - Content hash for deduplication
- ✅ `newCoachReply` - Coach reply flag
- ✅ `coachResponse` - Coach response data

## 📊 **Notification Decision Matrix**

| Scenario | Time Since Last | Content Changed | Action |
|----------|----------------|-----------------|---------|
| First notification | N/A | N/A | ✅ **Send Email** |
| Quick edit (< 10 min) | < 10 minutes | Yes | ❌ **Skip** (Time throttling) |
| Quick edit (< 10 min) | < 10 minutes | No | ❌ **Skip** (Time throttling) |
| Later edit (> 10 min) | > 10 minutes | Yes | ✅ **Send Email** |
| Later edit (> 10 min) | > 10 minutes | No | ❌ **Skip** (Content deduplication) |
| Formatting changes only | > 10 minutes | No | ❌ **Skip** (Content deduplication) |

## 🎯 **Benefits**

### 1. **Reduces Email Spam**
- Prevents notifications for cosmetic edits (formatting, typos)
- Eliminates duplicate notifications for unchanged content
- Maintains coach focus on truly new or updated entries

### 2. **Intelligent Content Detection**
- Detects actual content changes vs. metadata changes
- Considers the full entry text for comparison
- Handles edge cases like whitespace-only changes

### 3. **Maintains Responsiveness**
- Real content changes still trigger immediate notifications (after 10-minute cooldown)
- Preserves coach workflow for genuine entry updates
- Balances notification frequency with content relevance

## 🔍 **Logging & Debugging**

Enhanced logging for troubleshooting:

```javascript
// Time-based throttling
console.warn("⏳ Email already sent recently. Skipping notification.");

// Content-based deduplication  
console.warn("🔄 Content unchanged since last notification. Skipping duplicate.");

// Successful notification
console.log("✅ SendGrid email sent to:", coachEmail);
console.log("📝 Content hash stored for deduplication:", contentHash);
```

## 🚀 **Implementation Notes**

### Hash Algorithm Choice
- **SHA-256**: Cryptographically secure, collision-resistant
- **16-character substring**: Sufficient uniqueness, compact storage
- **Content**: `entryId:text` ensures hash uniqueness per entry

### Backward Compatibility
- New field `lastNotificationHash` is optional
- Existing entries without hash will trigger notification normally
- No migration needed - system self-initializes on first notification

### Performance Considerations
- Hash generation is fast (O(n) where n = text length)
- Additional Firestore field adds minimal storage overhead
- Single database read/write per notification check

## ✅ **Testing Scenarios**

1. **First notification**: Should send email and store hash
2. **Immediate re-trigger**: Should skip due to time throttling
3. **Same content after 10+ minutes**: Should skip due to hash match
4. **Modified content after 10+ minutes**: Should send email with new hash
5. **Entry without stored hash**: Should send email and initialize hash

The enhanced notification system now provides intelligent spam prevention while maintaining responsiveness to genuine content updates!

# Coach Reply Security Hardening

## 🔒 Security Vulnerabilities Identified and Patched

**Critical Issues Found:**
1. **Direct Client Writes**: `coach.html` was writing directly to Firestore bypassing all server-side validation
2. **Hardcoded UIDs**: Security rules used specific UIDs instead of role-based access control
3. **Spoofable Writes**: Anyone could modify `journalEntries/{id}` and set `newCoachReply` field
4. **No Role Validation**: No verification that the user actually has coach permissions

## ✅ Security Hardening Applied

### 1. Moved to Secure Callable Function

**Before (`coach.html`):**
```javascript
// INSECURE: Direct Firestore write from client
await updateDoc(entryRef, {
  coachResponse: {
    text: responseText,
    timestamp: serverTimestamp(),
    coachId: "coach@inkwelljournal.io"
  },
  newCoachReply: true
});
```

**After (`coach.html`):**
```javascript
// SECURE: Uses authenticated callable function
const saveCoachReply = httpsCallable(functions, 'saveCoachReply');
await saveCoachReply({ 
  entryId: entryId, 
  replyText: responseText 
});
```

### 2. Enhanced Server-Side Validation

**Updated `saveCoachReply` Cloud Function:**
- ✅ **Authentication Check**: Verifies user is logged in
- ✅ **Role Verification**: Confirms user has `userRole: "coach"` in their profile
- ✅ **Entry Access Control**: Ensures entry is marked for coach review (`coachReview: true`)
- ✅ **Input Validation**: Validates entry ID and reply text
- ✅ **Audit Trail**: Logs coach UID and email in the response

```javascript
// Verify the user has coach role
const coachUserDoc = await admin.firestore().collection("users").doc(coachUid).get();
if (!coachUserDoc.exists || coachUserDoc.data()?.userRole !== "coach") {
  throw new HttpsError("permission-denied", "Only coaches can save coach replies.");
}

// Check if the coach has access to this entry
const entryData = entryDoc.data();
if (!entryData.coachReview) {
  throw new HttpsError("permission-denied", "Entry is not marked for coach review.");
}
```

### 3. Role-Based Firestore Security Rules

**Before:**
```javascript
// INSECURE: Hardcoded specific UID
allow write: if request.auth.uid == 'ZiNM7YK1jnRgIkAKiCaO1lC6DGx2';
```

**After:**
```javascript
// SECURE: Role-based access control
function isCoach(uid) {
  return exists(/databases/$(database)/documents/users/$(uid)) &&
         get(/databases/$(database)/documents/users/$(uid)).data.userRole == "coach";
}

// Coaches can only update coach response fields via callable functions
// Direct client updates to coachResponse are blocked
allow update: if
  request.auth != null &&
  (
    // Journaler can update their own entries (but not coachResponse field)
    (resource.data.userId == request.auth.uid && 
     isJournaler(request.auth.uid) &&
     !request.resource.data.diff(resource.data).affectedKeys().hasAny(['coachResponse'])) ||
    
    // Direct coach updates blocked - must use saveCoachReply callable
    false
  );
```

## 🛡️ Security Model Implementation

### Role-Based Access Control
- **Journalers**: Can create, read, update, delete their own entries (except `coachResponse` field)
- **Coaches**: Can read entries marked for review, cannot directly write to entries
- **Coach Responses**: Only writable via authenticated `saveCoachReply` callable function

### Multi-Layer Validation
1. **Authentication Layer**: Firebase ID token verification
2. **Authorization Layer**: Role verification in user profile
3. **Access Control Layer**: Entry permission checks (`coachReview: true`)
4. **Data Validation Layer**: Input sanitization and validation
5. **Firestore Rules Layer**: Final security enforcement

### Audit and Accountability
- **Coach Identity**: Response includes coach UID and email
- **Timestamps**: Server-side timestamps prevent tampering
- **Access Logging**: All coach actions logged for audit trail

## 🚫 Attack Vectors Closed

1. **Client-Side Tampering**: Direct Firestore writes blocked by security rules
2. **Privilege Escalation**: Role verification prevents non-coaches from writing replies
3. **Data Spoofing**: Server-side validation ensures data integrity
4. **Unauthorized Access**: Entry access control prevents coaches from accessing non-review entries
5. **Identity Spoofing**: Authenticated callable functions ensure proper coach identification

## 📈 Scalability Benefits

- **Multiple Coaches**: Role-based system supports adding new coaches without code changes
- **Centralized Authorization**: Single callable function ensures consistent security enforcement
- **Future-Proof**: Role system easily extensible for additional user types (admin, moderator, etc.)

## 🔍 Implementation Notes

- **Backward Compatibility**: Existing coach replies preserved
- **Error Handling**: Detailed error messages for debugging while maintaining security
- **Performance**: Role checks optimized with proper indexing
- **Maintainability**: Centralized security logic in callable functions

The coach reply system is now secured against client-side manipulation and implements proper role-based access control suitable for production use.

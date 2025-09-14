# Coach Reply Notification System Implementation

## Issue
The coach reply notifications were not showing up anywhere in the application. There should be:
1. A toast notification on login when new coach replies exist
2. Calendar date highlighting in 'Sophy Coral' color for dates with new replies
3. Visual indicators on past entries showing new coach replies

## Root Cause Analysis
The coach reply checking functionality was supposed to be "moved to auth.js" but was never actually implemented. The system had:
- ✅ Backend functions to save coach replies with `newCoachReply: true` flag
- ✅ Frontend UI to display coach replies with visual indicators
- ❌ Missing login-time check for new coach replies
- ❌ Missing calendar highlighting for dates with new replies
- ❌ Missing global access to `showToast` function

## Implementation Details

### 1. Coach Reply Check Function (`auth.js`)
```javascript
async function checkForCoachReplies() {
  // Query journalEntries collection for entries with newCoachReply: true
  // Show toast notification if new replies found
  // Highlight calendar dates with new replies
  // Refresh past entries if calendar tab is active
}
```

### 2. Calendar Highlighting (`auth.js`)
- Updated `buildCalendar()` to add `data-date` attributes to calendar cells
- Added `highlightCalendarDatesWithReplies()` function to apply Sophy Coral styling
- Added 💬 emoji indicator on highlighted dates

### 3. Integration Points
- **Login Trigger**: `checkForCoachReplies()` called in `onAuthStateChanged` after agreement check
- **Database Query**: Queries `journalEntries` collection with `userId` and `newCoachReply: true` filters
- **Visual Feedback**: Toast notification + calendar highlighting + past entries refresh

### 4. Database Structure Compatibility
Fixed query to match actual database structure:
- Collection: `"journalEntries"` (not `"users/{userId}/entries"`)
- User field: `userId` for filtering
- Date field: `createdAt` (Firestore timestamp)
- Text field: `text` (not `entry`)

### 5. Global Function Access
Made `showToast` function globally available via `window.showToast` for cross-file usage.

## Expected Behavior

### On Login
1. System checks for entries with `newCoachReply: true`
2. If found, shows toast: "💬 You have X new coach replies! Look for entries with the 'NEW REPLY' badge."
3. Calendar dates with new replies highlighted in Sophy Coral (`--accent: #d49489`)
4. Calendar cells show 💬 indicator

### In Past Entries (Calendar Tab)
1. Entries with new replies show highlighted background
2. "NEW REPLY" badge displayed prominently
3. Coach replies shown in special container with "Mark as Read" button

### Mark as Read
1. User clicks "Mark as Read" button
2. Updates entry with `newCoachReply: false`
3. Visual indicators removed
4. Entry styling returns to normal

## Files Modified
- `/public/auth.js`: Added coach reply checking and calendar highlighting
- Database queries updated for correct collection/field structure
- Global function exports updated

## Testing Notes
- Added detailed console logging for debugging
- Error handling for Firebase query issues
- Graceful fallbacks if elements not found
- Compatible with both development and production environments

## Color Scheme
- **New Reply Highlight**: `--accent: #d49489` (Sophy Coral)
- **Border**: `--accent-dark: #723332`
- **Toast**: Success styling with brand colors
- **Calendar Indicator**: 💬 emoji overlay

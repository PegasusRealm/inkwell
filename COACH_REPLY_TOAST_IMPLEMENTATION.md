# Coach Reply Toast Implementation

## Overview
This document outlines the implementation of the coach reply toast notification system that displays and marks past journal entries that have received replies from coaches.

## Features Implemented

### ✅ Visual Indicators for New Replies
- **Entry Card Highlighting**: Entries with new coach replies are visually distinguished with:
  - Light yellow/amber background gradient
  - Red left border (5px)
  - Subtle red shadow
  - "NEW REPLY" badge in top-right corner

### ✅ Toast Notifications
- **Global Notification**: When Past Entries are loaded and new coach replies exist, a toast appears:
  - Message: "💬 You have new coach replies! Look for entries with the 'NEW REPLY' badge."
  - Duration: 8 seconds
  - Type: Success (green)

### ✅ Coach Reply Display
- **New Replies**: Displayed with red/pink styling and "NEW" badge
- **Read Replies**: Displayed with green styling (original design)
- **Mark as Read Button**: Each new reply section includes a "✓ Mark as Read" button

### ✅ Mark as Read Functionality
- **Client-side Update**: Direct Firestore update to set `newCoachReply: false`
- **Security**: Firestore rules allow users to set `newCoachReply` to `false` only
- **UI Refresh**: Automatically refreshes entries after marking as read
- **Feedback**: Success toast confirmation

## Technical Implementation

### Backend Changes
1. **Cloud Function**: `markCoachRepliesAsRead` (alternative approach, not currently used)
2. **Firestore Rules**: Updated to allow users to set `newCoachReply` to `false`

### Frontend Changes
1. **Visual Styling**: Enhanced entry card styling with conditional highlighting
2. **Coach Reply Rendering**: Separate styling for new vs. read replies
3. **Mark as Read Function**: `window.markCoachRepliesAsRead(entryId)`
4. **Toast Integration**: Uses existing toast system with better messaging

### Security Considerations
- Users can only mark their own entries as read
- Users cannot set `newCoachReply` to `true` (only coaches can via Cloud Functions)
- All operations are authenticated and validated

## File Changes

### `/functions/index.js`
- Added `markCoachRepliesAsRead` Cloud Function (backup approach)

### `/firestore.rules`
- Updated journal entry update rules to allow `newCoachReply: false`

### `/public/index.html`
- Enhanced `loadPastEntries()` function with new reply handling
- Added visual styling for entries with new replies
- Added `markCoachRepliesAsRead()` function
- Updated CSS for `entry-card` positioning
- Improved toast notification messaging

## Usage Flow

1. **Coach submits reply** → `newCoachReply: true` set on entry
2. **User loads Past Entries** → Toast notification appears if new replies exist
3. **User sees highlighted entries** → Visual indicators show which entries have new replies
4. **User reads replies** → Coach replies are displayed in the entry
5. **User clicks "Mark as Read"** → `newCoachReply` flag is cleared
6. **Entry styling updates** → Entry returns to normal styling

## Testing Recommendations

1. Create a journal entry and tag it for coach review
2. Have a coach reply to the entry
3. Reload the journal as the original user
4. Verify toast notification appears
5. Verify entry is visually highlighted
6. Verify "Mark as Read" button functions
7. Verify entry returns to normal styling after marking as read

## Future Enhancements

- Count of unread replies in navigation
- Email/push notifications for new coach replies
- Reply threading for multi-turn conversations
- Auto-mark as read when user scrolls to/views the reply

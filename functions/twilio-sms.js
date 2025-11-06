// =============================================================================
// TWILIO SMS FUNCTIONS
// =============================================================================
// Add this code to the end of functions/index.js

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = defineSecret("TWILIO_PHONE_NUMBER");

/**
 * Send test SMS to verify phone number
 */
exports.sendTestSMS = onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER] },
  async (request) => {
    // Verify user is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be logged in to send SMS');
    }

    const { phoneNumber } = request.data;

    if (!phoneNumber) {
      throw new HttpsError('invalid-argument', 'Phone number is required');
    }

    try {
      // Initialize Twilio client
      const twilio = require('twilio');
      const client = twilio(
        TWILIO_ACCOUNT_SID.value(),
        TWILIO_AUTH_TOKEN.value()
      );

      // Send test message
      const message = await client.messages.create({
        body: '🌱 Hello from InkWell! This is a test message to confirm your phone number is working. Reply STOP to unsubscribe.',
        from: TWILIO_PHONE_NUMBER.value(),
        to: phoneNumber
      });

      console.log('✅ Test SMS sent:', message.sid);

      return {
        success: true,
        messageSid: message.sid,
        status: message.status
      };
    } catch (error) {
      console.error('❌ Failed to send test SMS:', error);
      throw new HttpsError('internal', `Failed to send SMS: ${error.message}`);
    }
  }
);

/**
 * Send WISH milestone reminder SMS
 */
exports.sendWishMilestone = onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be logged in');
    }

    const { phoneNumber, milestone, daysElapsed, totalDays } = request.data;

    if (!phoneNumber || !milestone) {
      throw new HttpsError('invalid-argument', 'Phone number and milestone are required');
    }

    try {
      const twilio = require('twilio');
      const client = twilio(
        TWILIO_ACCOUNT_SID.value(),
        TWILIO_AUTH_TOKEN.value()
      );

      let messageText = '';
      if (milestone === 'quarter') {
        messageText = `🌱 InkWell: You're 25% through your WISH journey! (${daysElapsed}/${totalDays} days). Keep growing!`;
      } else if (milestone === 'half') {
        messageText = `🍀 InkWell: Halfway there! You've completed ${daysElapsed} of ${totalDays} days. Your WISH is blooming!`;
      } else if (milestone === 'three-quarters') {
        messageText = `🌿 InkWell: 75% complete! Only ${totalDays - daysElapsed} days left on your WISH journey. You're amazing!`;
      } else if (milestone === 'complete') {
        messageText = `🌳 InkWell: Congratulations! You've completed your ${totalDays}-day WISH journey! Time to reflect and set a new WISH.`;
      } else {
        messageText = `🌱 InkWell: WISH milestone reached! Keep up the great work on your journey.`;
      }

      const message = await client.messages.create({
        body: messageText,
        from: TWILIO_PHONE_NUMBER.value(),
        to: phoneNumber
      });

      console.log('✅ WISH milestone SMS sent:', message.sid);

      return {
        success: true,
        messageSid: message.sid
      };
    } catch (error) {
      console.error('❌ Failed to send WISH milestone SMS:', error);
      throw new HttpsError('internal', `Failed to send SMS: ${error.message}`);
    }
  }
);

/**
 * Send daily journal prompt SMS
 */
exports.sendDailyPrompt = onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be logged in');
    }

    const { phoneNumber, prompt } = request.data;

    if (!phoneNumber) {
      throw new HttpsError('invalid-argument', 'Phone number is required');
    }

    try {
      const twilio = require('twilio');
      const client = twilio(
        TWILIO_ACCOUNT_SID.value(),
        TWILIO_AUTH_TOKEN.value()
      );

      const messageText = prompt || '✍️ InkWell: Time to reflect. What went well today? What are you grateful for?';

      const message = await client.messages.create({
        body: messageText,
        from: TWILIO_PHONE_NUMBER.value(),
        to: phoneNumber
      });

      console.log('✅ Daily prompt SMS sent:', message.sid);

      return {
        success: true,
        messageSid: message.sid
      };
    } catch (error) {
      console.error('❌ Failed to send daily prompt SMS:', error);
      throw new HttpsError('internal', `Failed to send SMS: ${error.message}`);
    }
  }
);

/**
 * Send coach reply notification SMS
 */
exports.sendCoachReplyNotification = onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be logged in');
    }

    const { phoneNumber, coachName } = request.data;

    if (!phoneNumber) {
      throw new HttpsError('invalid-argument', 'Phone number is required');
    }

    try {
      const twilio = require('twilio');
      const client = twilio(
        TWILIO_ACCOUNT_SID.value(),
        TWILIO_AUTH_TOKEN.value()
      );

      const messageText = `💬 InkWell: ${coachName || 'Your coach'} replied to your journal entry! Log in to read their message.`;

      const message = await client.messages.create({
        body: messageText,
        from: TWILIO_PHONE_NUMBER.value(),
        to: phoneNumber
      });

      console.log('✅ Coach reply notification SMS sent:', message.sid);

      return {
        success: true,
        messageSid: message.sid
      };
    } catch (error) {
      console.error('❌ Failed to send coach reply notification SMS:', error);
      throw new HttpsError('internal', `Failed to send SMS: ${error.message}`);
    }
  }
);

/**
 * Send generic SMS notification
 */
exports.sendSMS = onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be logged in');
    }

    const { phoneNumber, message } = request.data;

    if (!phoneNumber || !message) {
      throw new HttpsError('invalid-argument', 'Phone number and message are required');
    }

    try {
      const twilio = require('twilio');
      const client = twilio(
        TWILIO_ACCOUNT_SID.value(),
        TWILIO_AUTH_TOKEN.value()
      );

      const smsMessage = await client.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER.value(),
        to: phoneNumber
      });

      console.log('✅ SMS sent:', smsMessage.sid);

      return {
        success: true,
        messageSid: smsMessage.sid,
        status: smsMessage.status
      };
    } catch (error) {
      console.error('❌ Failed to send SMS:', error);
      throw new HttpsError('internal', `Failed to send SMS: ${error.message}`);
    }
  }
);

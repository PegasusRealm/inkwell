const { defineSecret } = require("firebase-functions/params"); 
const { getApps } = require("firebase-admin/app");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const fetch = require("node-fetch");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const RECAPTCHA_SECRET_KEY = defineSecret("RECAPTCHA_SECRET_KEY");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const MAILCHIMP_API_KEY = defineSecret("MAILCHIMP_API_KEY");
const MAILCHIMP_LIST_ID = defineSecret("MAILCHIMP_LIST_ID");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
if (!getApps().length) {
  admin.initializeApp();
}

// Helper: Create user profile in Firestore if not exists
async function createUserProfileIfNotExists(uid, email) {
  const userDocRef = admin.firestore().collection("users").doc(uid);
  const userDoc = await userDocRef.get();
  if (!userDoc.exists) {
    await userDocRef.set({
      userId: uid,
      email: email,
      displayName: email.split('@')[0], // Default to email prefix if no username
      signupUsername: email.split('@')[0],
      userRole: "journaler",
      special_code: "beta", // Tag all new users with beta
      agreementAccepted: false,
      avatar: "",
      // Default insight preferences for new users (opt-in by default)
      insightsPreferences: {
        weeklyEnabled: true,
        monthlyEnabled: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { created: true };
  }
  return { created: false };
}
const cors = require("cors");
const corsHandler = cors({ origin: true });

// Hardened CORS configuration
const ALLOWED_ORIGINS = [
  'http://localhost:5002', 
  'http://localhost:5000',  // Firebase hosting emulator default
  'http://127.0.0.1:5002',
  'http://127.0.0.1:5000',
  'https://inkwell-alpha.web.app',
  'https://inkwell-alpha.firebaseapp.com',
  'https://inkwelljournal.io',      // Production domain
  'https://www.inkwelljournal.io'   // Production domain with www
];

function setupHardenedCORS(req, res) {
  const origin = req.headers.origin;
  
  // Always set Vary: Origin for proper caching behavior
  res.set('Vary', 'Origin');
  
  // Check if origin is allowed
  if (!ALLOWED_ORIGINS.includes(origin)) {
    // Bail early on non-allowed origins
    return false;
  }
  
  // Set CORS headers for allowed origins
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return true;
}

function sendSecureErrorResponse(res, statusCode, userMessage, internalError = null) {
  if (internalError) {
    console.error("Internal error:", internalError);
  }
  
  // Don't leak internal details to client
  const safeMessage = typeof userMessage === 'string' ? userMessage : 'An error occurred';
  res.status(statusCode).json({ error: safeMessage });
}

// Helper: Generate unique request ID for tracking
function generateRequestId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper: Sleep function for retry delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Map technical errors to user-friendly messages
function mapErrorToUserMessage(error, functionContext = 'system') {
  const errorMessage = error?.message || '';
  const errorLower = errorMessage.toLowerCase();
  
  // OpenAI API specific errors
  if (errorLower.includes('timeout') || error.name === 'AbortError') {
    return {
      code: 'TIMEOUT',
      message: 'The request is taking longer than expected. Please try again.',
      retryable: true
    };
  }
  
  if (errorLower.includes('429') || errorLower.includes('rate limit')) {
    return {
      code: 'RATE_LIMITED',
      message: 'The service is currently busy. Please wait a moment and try again.',
      retryable: true
    };
  }
  
  if (errorLower.includes('401') || errorLower.includes('unauthorized')) {
    return {
      code: 'UNAUTHORIZED',
      message: 'Authentication failed. Please refresh the page and try again.',
      retryable: false
    };
  }
  
  if (errorLower.includes('403') || errorLower.includes('forbidden')) {
    return {
      code: 'FORBIDDEN',
      message: 'Access denied. Please check your permissions.',
      retryable: false
    };
  }
  
  if (errorLower.includes('400') || errorLower.includes('bad request')) {
    return {
      code: 'INVALID_REQUEST',
      message: 'Invalid request. Please check your input and try again.',
      retryable: false
    };
  }
  
  if (errorLower.includes('500') || errorLower.includes('502') || errorLower.includes('503') || errorLower.includes('504')) {
    return {
      code: 'SERVER_ERROR',
      message: 'The service is temporarily unavailable. Please try again in a few moments.',
      retryable: true
    };
  }
  
  // Network errors
  if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('connection')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Connection issue detected. Please check your internet and try again.',
      retryable: true
    };
  }
  
  // Context-specific fallbacks
  const contextMessages = {
    'askSophy': "Sophy couldn't provide a reflection right now. Please try again later.",
    'generatePrompt': "Unable to generate a writing prompt at the moment. Please try again.",
    'refineManifest': "Unable to refine your manifest statement right now. Please try again.",
    'cleanVoiceTranscript': "Unable to clean the voice transcript right now. Please try again.",
    'embedAndStoreEntry': "Unable to save your journal entry right now. Please try again."
  };
  
  return {
    code: 'UNKNOWN_ERROR',
    message: contextMessages[functionContext] || 'Something went wrong. Please try again later.',
    retryable: true
  };
}

// Helper: Robust OpenAI API call with timeout, retries, and proper logging
async function callAnthropicWithRetry(options, functionName, requestId) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    
    // Create AbortController with 20s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    try {
      console.log(`[${requestId}] ${functionName} attempt ${attempt}/${maxRetries} - calling Anthropic`);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY.value(),
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(options),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Log response details (safe for production)
      console.log(`[${requestId}] Anthropic response - status: ${response.status}, model: ${options.model}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[${requestId}] Anthropic success - usage: ${JSON.stringify(data.usage || {})}`);
        return data;
      }
      
      // Handle specific error codes
      if (response.status === 429 || response.status >= 500) {
        const errorText = await response.text();
        console.warn(`[${requestId}] Retryable error ${response.status}: ${response.statusText}`);
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`[${requestId}] Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
      }
      
      // Non-retryable error or final attempt
      const errorText = await response.text();
      console.error(`[${requestId}] Anthropic API error ${response.status}: ${response.statusText}`);
      
      // Create a technical error for mapping
      const technicalError = new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      const userError = mapErrorToUserMessage(technicalError, functionName);
      throw new Error(userError.message);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error(`[${requestId}] Anthropic request timeout (20s) on attempt ${attempt}`);
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`[${requestId}] Retrying after timeout in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        const userError = mapErrorToUserMessage(error, functionName);
        throw new Error(userError.message);
      }
      
      // Network or other errors
      console.error(`[${requestId}] Anthropic network error on attempt ${attempt}:`, error.message);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await sleep(delay);
        continue;
      }
      
      const userError = mapErrorToUserMessage(error, functionName);
      throw new Error(userError.message);
    }
  }
}

exports.generatePrompt = onRequest({ secrets: [ANTHROPIC_API_KEY] }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    const { topic } = req.body;
    const requestId = generateRequestId();
    
    // Safe logging - no full prompts in production
    console.log(`[${requestId}] generatePrompt - topic provided: ${!!topic}`);
    
    // Check if ANTHROPIC_API_KEY is available
    const hasApiKey = ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.value();
    console.log(`[${requestId}] generatePrompt - API key available: ${!!hasApiKey}`);
    
    if (!hasApiKey) {
      console.log(`[${requestId}] generatePrompt - Anthropic API key not configured`);
      res.status(500).json({ 
        error: "Sophy is taking a brief rest right now. Please try again in a moment, and if this keeps happening, drop us a note — we'd love to help you get back to journaling.",
        code: "AI_TEMPORARILY_UNAVAILABLE",
        retryable: true 
      });
      return;
    }

    const promptContent = topic
      ? `Give me a journaling prompt about: ${topic}`
      : "Give me a creative journaling prompt to help reflect on today.";

    const systemPrompt = `You are Sophy, a supportive journaling assistant. Generate thoughtful, engaging journaling prompts. Always respond with just the prompt text directly - never wrap your response in quotation marks or say things like "Here's a prompt:" or similar prefixes. Just provide the actual prompt text.`;

    const data = await callAnthropicWithRetry(
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 200,
        messages: [
          { role: "user", content: `${systemPrompt}\n\n${promptContent}` }
        ]
      },
      "generatePrompt",
      requestId
    );

    console.log(`[${requestId}] generatePrompt success`);
    
    // Clean up the response by removing any quotes and unnecessary formatting
    let cleanPrompt = data.content[0].text.trim();
    
    // Remove surrounding quotes if they exist
    if ((cleanPrompt.startsWith('"') && cleanPrompt.endsWith('"')) ||
        (cleanPrompt.startsWith("'") && cleanPrompt.endsWith("'"))) {
      cleanPrompt = cleanPrompt.slice(1, -1);
    }
    
    // Remove any prefixes like "Here's a prompt:" or similar
    cleanPrompt = cleanPrompt.replace(/^(Here's a prompt:|Here's your prompt:|Prompt:|Journal prompt:)\s*/i, '');
    
    res.status(200).json({ prompt: cleanPrompt });
  } catch (error) {
    console.error(`[${requestId || 'unknown'}] Prompt generation failed:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    const userError = mapErrorToUserMessage(error, 'generatePrompt');
    res.set('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: userError.message,
      code: userError.code,
      retryable: userError.retryable 
    });
  }
});

exports.askSophy = onRequest({ secrets: [ANTHROPIC_API_KEY] }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    const { entry } = req.body;
    const requestId = generateRequestId();
    
    // Safe logging - don't log full entry content
    console.log(`[${requestId}] askSophy - entry length: ${entry?.length || 0} chars`);

    const systemPrompt = `You are Sophy, a supportive journaling assistant informed by Gestalt Therapy, Positive Psychology, SAMHSA's Eight Dimensions of Wellness, Kukulu Kumuhana, and Atomic Habits. 

Respond directly in your own voice - never use stage directions, action descriptions, or phrases like "*responds warmly*" or "*nods empathetically*". Simply speak naturally and warmly.

Keep your reflections brief, focused, and emotionally clear — no more than 2–3 ideas at once. Break thoughts into short, readable paragraphs. Avoid overwhelming the user. If helpful, suggest small, practical actions that build momentum over time.

Begin your response immediately with your reflection - no introductions or narrative text.

IMPORTANT: This is a one-time reflection, not a conversation. Do not include phrases like "Let me know if you'd like to discuss further", "Would you like me to help with...", "Feel free to share more", or any other conversational follow-ups. Just provide your reflection and end naturally.`;

    const data = await callAnthropicWithRetry(
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 500,
        messages: [
          { role: "user", content: `${systemPrompt}\n\nPlease provide a thoughtful reflection on this journal entry:\n\n${entry}` }
        ]
      },
      "askSophy",
      requestId
    );

    console.log(`[${requestId}] askSophy success`);
    
    // Clean the response to remove any stage directions or narrative text
    let cleanedInsight = data.content[0].text.trim();
    
    // Remove common stage direction patterns
    cleanedInsight = cleanedInsight
      .replace(/^\*[^*]*\*\s*/g, '') // Remove opening stage directions
      .replace(/\*[^*]*\*$/g, '') // Remove ending stage directions
      .replace(/\*[^*]*\*/g, '') // Remove any remaining stage directions
      .replace(/^(Sophy\s+)?(responds?|says?|speaks?|nods?|smiles?|looks?)\s+(warmly|empathetically|thoughtfully|gently|softly)[:\s]*/gi, '')
      .replace(/^Hello,?\s+\w+\.\s*/i, '') // Remove greeting patterns
      .replace(/^\*with\s+warmth\s+and\s+empathy\*\s*/gi, '') // Remove specific empathy stage direction
      .replace(/^\*[^*]*warmth[^*]*\*\s*/gi, '') // Remove warmth-related stage directions
      .replace(/^\*[^*]*empathy[^*]*\*\s*/gi, '') // Remove empathy-related stage directions
      .replace(/^\*[^*]*empathetically[^*]*\*\s*/gi, '') // Remove empathetically stage directions
      .replace(/I\s+sense\s+there\s+is\s+an\s+important\s+wish/gi, '') // Remove specific AI prompt leakage
      .replace(/^Let's\s+take\s+a\s+moment\s+to\s+vividly\s+imagine/gi, '') // Remove prompt instruction leakage
      .trim();
    
    res.status(200).json({ insight: cleanedInsight });
  } catch (error) {
    console.error("Reflection generation failed:", error.message);
    const userError = mapErrorToUserMessage(error, 'askSophy');
    res.set('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      insight: userError.message,
      code: userError.code,
      retryable: userError.retryable 
    });
  }
});

// Save manifest statement for authenticated user
exports.saveManifest = onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { statement } = data;
  if (!statement || typeof statement !== "string") {
    throw new HttpsError("invalid-argument", "Manifest statement must be a non-empty string.");
  }

  try {
    await admin.firestore().collection("manifests").doc(uid).set({
      statement,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving manifest:", error);
    throw new HttpsError("internal", "Unable to save your manifest statement right now. Please try again.", { 
      code: 'SAVE_ERROR', 
      retryable: true 
    });
  }
});

// Load manifest statement for authenticated user
exports.loadManifest = onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  try {
    const doc = await admin.firestore().collection("manifests").doc(uid).get();
    if (!doc.exists) {
      return { statement: "" };
    }
    return { statement: doc.data().statement || "" };
  } catch (error) {
    console.error("Error loading manifest:", error);
    throw new HttpsError("internal", "Unable to load your manifest statement right now. Please try again.", { 
      code: 'LOAD_ERROR', 
      retryable: true 
    });
  }
});


// Ask Sophy to refine manifest statement
exports.refineManifest = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { statement } = data;
  if (!statement || typeof statement !== "string") {
    throw new HttpsError("invalid-argument", "Manifest statement must be a non-empty string.");
  }

  const prompt = `Please help refine this personal manifest statement to make it meaningful, clear, and inspiring:\n"${statement}"`;

  try {
    const requestId = generateRequestId();
    
    // Safe logging - don't log full statement content
    console.log(`[${requestId}] refineManifest - statement length: ${statement?.length || 0} chars`);

    const result = await callAnthropicWithRetry(
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 300,
        messages: [
          { role: "user", content: `You are a journaling assistant that helps users articulate their vision and purpose in a supportive, emotionally aware tone.\n\n${prompt}` }
        ]
      },
      "refineManifest",
      requestId
    );

    console.log(`[${requestId}] refineManifest success`);
    
    // Clean the response to remove any stage directions or narrative text
    let cleanedResult = result.content[0].text.trim();
    
    // Remove common stage direction patterns
    cleanedResult = cleanedResult
      .replace(/^\*[^*]*\*\s*/g, '') // Remove opening stage directions
      .replace(/\*[^*]*\*$/g, '') // Remove ending stage directions
      .replace(/\*[^*]*\*/g, '') // Remove any remaining stage directions
      .replace(/^(Sophy\s+)?(responds?|says?|speaks?|nods?|smiles?|looks?)\s+(warmly|empathetically|thoughtfully|gently|softly)[:\s]*/gi, '')
      .replace(/^Hello,?\s+\w+\.\s*/i, '') // Remove greeting patterns
      .replace(/^\*with\s+warmth\s+and\s+empathy\*\s*/gi, '') // Remove specific empathy stage direction
      .replace(/^\*[^*]*warmth[^*]*\*\s*/gi, '') // Remove warmth-related stage directions
      .replace(/^\*[^*]*empathy[^*]*\*\s*/gi, '') // Remove empathy-related stage directions
      .replace(/I\s+sense\s+there\s+is\s+an\s+important\s+wish/gi, '') // Remove specific AI prompt leakage
      .replace(/Let's\s+take\s+a\s+moment\s+to\s+vividly\s+imagine/gi, '') // Remove prompt instruction leakage
      .trim();
    
    return { refined: cleanedResult };
  } catch (error) {
    console.error("Manifest refinement failed:", error.message);
    const userError = mapErrorToUserMessage(error, 'refineManifest');
    throw new HttpsError("internal", userError.message, { 
      code: userError.code, 
      retryable: userError.retryable 
    });
  }
});

// Clean up rough voice transcript into readable text (HTTP endpoint with CORS)
exports.cleanVoiceTranscript = onRequest({ secrets: [ANTHROPIC_API_KEY] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send("");

  const transcript = req.body.transcript || req.body.rawText;
  console.log("🧾 Received raw transcript:", transcript);
  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 2) {
    console.warn("⚠️ Invalid or too short transcript received.");
    return res.status(400).json({ error: "No cleaned text received." });
  }

  try {
    const requestId = generateRequestId();
    
    // Safe logging - don't log full transcript content
    console.log(`[${requestId}] cleanVoiceTranscript - transcript length: ${transcript?.length || 0} chars`);

    const data = await callAnthropicWithRetry(
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Clean this voice transcript by adding proper punctuation, capitalization, and fixing minor grammar errors. Keep the exact same words and natural speech patterns. Return ONLY the cleaned speech with no introductions, explanations, or commentary.

Examples:
Input: "trying ink out loud to see how it works my name is adam and im sitting at my desk"
Output: "Trying Ink Out Loud to see how it works. My name is Adam and I'm sitting at my desk."

Input: "today was really good i went to the store and bought some groceries then came home"
Output: "Today was really good. I went to the store and bought some groceries, then came home."

Transcript to clean:
${transcript}`
          }
        ]
      },
      "cleanVoiceTranscript",
      requestId
    );

    let cleanedText = data?.content?.[0]?.text?.trim();

    if (!cleanedText) {
      throw new Error("No cleaned text returned from AI.");
    }

    // Strip out common AI narrative introductions
    const narrativePrefixes = [
      /^Here is the transcript with punctuation and minor grammar corrections:\s*/i,
      /^Here is the cleaned transcript:\s*/i,
      /^Here's the cleaned version:\s*/i,
      /^The corrected transcript:\s*/i,
      /^Cleaned transcript:\s*/i,
      /^Here is the corrected version:\s*/i
    ];

    for (const pattern of narrativePrefixes) {
      cleanedText = cleanedText.replace(pattern, '');
    }

    // Remove any remaining quotes that might wrap the content
    cleanedText = cleanedText.replace(/^["']|["']$/g, '').trim();

    console.log(`[${requestId}] cleanVoiceTranscript success`);
    res.status(200).json({ cleanedText });
  } catch (error) {
    console.error("cleanVoiceTranscript error:", error.message);
    const userError = mapErrorToUserMessage(error, 'cleanVoiceTranscript');
    res.status(500).json({ 
      error: userError.message,
      code: userError.code,
      retryable: userError.retryable 
    });
  }
});

exports.embedAndStoreEntry = onRequest({ secrets: [ANTHROPIC_API_KEY] }, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }
  
  corsHandler(req, res, async () => {
    console.log("Received body:", req.body);
    try {
      const authHeader = req.headers.authorization || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

      if (!idToken) {
        return res.status(401).json({ error: 'Unauthorized: Missing token' });
      }

      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const { text, entryId } = req.body;
      if (!text || !entryId) {
        return res.status(400).json({ error: 'Missing required text or entryId' });
      }

      const requestId = generateRequestId();
      
      // Save entry without embedding (we'll use Anthropic for semantic search instead)
      console.log(`[${requestId}] embedAndStoreEntry - saving entry without embedding`);
      
      await admin.firestore().collection("journalEntries").doc(entryId).set({
        userId: uid,
        text,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        // Add some basic text processing for simple search fallback
        searchableText: text.toLowerCase()
      }, { merge: true });

      console.log(`[${requestId}] embedAndStoreEntry success (text-based storage)`);
      res.status(200).json({ message: "Entry saved successfully" });
    } catch (error) {
      console.error("Entry storage error:", error.message);
      const userError = mapErrorToUserMessage(error, 'embedAndStoreEntry');
      res.status(500).json({ 
        error: userError.message,
        code: userError.code,
        retryable: userError.retryable 
      });
    }
  });
});

// New semantic search function using Anthropic
exports.semanticSearch = onRequest({ secrets: [ANTHROPIC_API_KEY] }, async (req, res) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Semantic search request started`);
  
  // Apply hardened CORS
  if (!setupHardenedCORS(req, res)) {
    console.warn(`[${requestId}] Rejected request from unauthorized origin: ${req.headers.origin}`);
    return res.status(403).send('Forbidden');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

    if (!idToken) {
      console.warn(`[${requestId}] Missing authorization token`);
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    console.log(`[${requestId}] User authenticated: ${uid}`);

    const { query } = req.body;
    if (!query) {
      console.error(`[${requestId}] Missing search query`);
      return res.status(400).json({ error: 'Missing search query' });
    }

    console.log(`[${requestId}] semanticSearch - query length: ${query.length} chars`);

    // Fetch user's journal entries - use createdAt instead of timestamp
    const entriesSnapshot = await admin.firestore()
      .collection("journalEntries")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(50) // Limit to recent entries for performance
      .get();

    if (entriesSnapshot.empty) {
      console.log(`[${requestId}] No entries found for user`);
      return res.status(200).json({ results: [] });
    }

    const entries = [];
    entriesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.text && data.text.trim()) {
        entries.push({
          id: doc.id,
          text: data.text,
          createdAt: data.createdAt,
          tags: data.tags || [],
          contextManifest: data.contextManifest,
          reflectionUsed: data.reflectionUsed
        });
      }
    });

    console.log(`[${requestId}] Found ${entries.length} entries to analyze`);

    if (entries.length === 0) {
      return res.status(200).json({ results: [] });
    }

    // Check if ANTHROPIC_API_KEY is available
    const hasApiKey = ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.value();
    
    if (!hasApiKey) {
      console.warn(`[${requestId}] Anthropic API key not available, using fallback text search`);
      
      // Fallback to simple text search
      const queryLower = query.toLowerCase();
      const rankedResults = entries
        .map((entry, index) => ({
          ...entry,
          score: (entry.text.toLowerCase().includes(queryLower) ? 1 : 0) +
                 (entry.tags?.some(tag => tag.toLowerCase().includes(queryLower)) ? 0.5 : 0) +
                 (entry.contextManifest?.toLowerCase().includes(queryLower) ? 0.3 : 0)
        }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(entry => {
          delete entry.score;
          return entry;
        });

      console.log(`[${requestId}] Fallback search returning ${rankedResults.length} results`);
      return res.status(200).json({ results: rankedResults });
    }

    // Use Anthropic to rank entries by semantic relevance
    const entriesText = entries.map((entry, index) => 
      `Entry ${index + 1}: ${entry.text.substring(0, 300)}${entry.text.length > 300 ? '...' : ''}`
    ).join('\n\n');

    const analysisPrompt = `You are helping with journal search. Given the search query and journal entries below, identify which entries are most semantically relevant to the query. Consider themes, emotions, topics, and concepts - not just keyword matches.

Search Query: "${query}"

Journal Entries:
${entriesText}

Please respond with ONLY a JSON array of entry numbers (1-${entries.length}) ranked by relevance, most relevant first. Include only entries that have meaningful relevance to the query. For example: [3, 7, 1, 12]

If no entries are meaningfully relevant, return an empty array: []`;

    const result = await callAnthropicWithRetry(
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 500,
        messages: [
          { role: "user", content: analysisPrompt }
        ]
      },
      "semanticSearch",
      requestId
    );

    const responseText = result.content[0].text.trim();
    console.log(`[${requestId}] Anthropic ranking response: ${responseText}`);

    // Parse the ranking response
    let rankedIndices = [];
    try {
      rankedIndices = JSON.parse(responseText);
      if (!Array.isArray(rankedIndices)) {
        throw new Error("Response is not an array");
      }
    } catch (parseError) {
      console.warn(`[${requestId}] Failed to parse ranking, falling back to text search`);
      // Fallback to simple text search
      const queryLower = query.toLowerCase();
      rankedIndices = entries
        .map((entry, index) => ({
          index: index + 1,
          score: (entry.text.toLowerCase().includes(queryLower) ? 1 : 0) +
                 (entry.tags?.some(tag => tag.toLowerCase().includes(queryLower)) ? 0.5 : 0)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.index);
    }

    // Convert indices to actual entries and return results
    const rankedResults = rankedIndices
      .map(index => entries[index - 1])
      .filter(entry => entry) // Remove any invalid indices
      .slice(0, 10); // Return top 10 results

    console.log(`[${requestId}] semanticSearch success - returning ${rankedResults.length} results`);
    res.status(200).json({ results: rankedResults });

  } catch (error) {
    console.error(`[${requestId}] Semantic search error:`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    const userError = mapErrorToUserMessage(error, 'semanticSearch');
    res.status(500).json({ 
      error: userError.message,
      code: userError.code,
      retryable: userError.retryable 
    });
  }
});
// Log search query function
exports.logSearchQuery = onRequest(async (req, res) => {
  // CORS: Always set these headers FIRST!
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight support
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // Log the entry for debugging
  console.log("logSearchQuery called. Method:", req.method, "Body:", req.body);
  console.log("DEBUG req.headers:", req.headers);

  try {
    // Enforce POST only
    if (req.method !== 'POST') {
      console.warn("Method not allowed:", req.method);
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Extract Bearer token
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
    if (!idToken) {
      console.warn("Missing token in Authorization header.");
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      console.error("Failed to verify ID token:", e.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    if (!decoded || !decoded.uid) {
      console.warn("Decoded token missing UID");
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    const uid = decoded.uid;

    // Validate input
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      console.warn("Query missing or not a string:", req.body);
      return res.status(400).json({ error: 'Query must be a non-empty string.' });
    }

    // Save to Firestore
    await admin.firestore().collection('searchLogs').add({
      userId: uid,
      query,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Logged search query for user:", uid, "query:", query);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error logging search query:", error);
    // CORS headers already set above, don't need to repeat
    return res.status(500).json({ error: "Failed to log search query." });
  }
});

// HTTP function with explicit CORS handling for coach replies
exports.saveCoachReplyHTTP = onRequest({
  cors: true
}, async (req, res) => {
  try {
    console.log("🔍 saveCoachReplyHTTP called with method:", req.method);
    console.log("🔍 Headers:", req.headers);
    console.log("🔍 Body:", req.body);

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send('');
      return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Get the ID token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("❌ No authorization header found");
      res.status(401).json({ error: 'Practitioner must be authenticated.' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    console.log("🔑 ID token received:", idToken?.substring(0, 20) + "...");

    // Verify the ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log("✅ Token verified for user:", decodedToken.uid);
    } catch (tokenError) {
      console.error("❌ Token verification failed:", tokenError);
      res.status(401).json({ error: 'Invalid authentication token.' });
      return;
    }

    const coachUid = decodedToken.uid;

    // Verify the user has coach role
    try {
      const userDoc = await admin.firestore().collection("users").doc(coachUid).get();
      console.log("📋 User document exists:", userDoc.exists);
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log("👤 User data:", {
          userRole: userData?.userRole,
          email: userData?.email
        });
      }
      
      if (!userDoc.exists || userDoc.data()?.userRole !== "coach") {
        console.error("❌ User does not have coach role");
        res.status(403).json({ error: 'User does not have practitioner permissions.' });
        return;
      }
    } catch (roleError) {
      console.error("❌ Error checking coach role:", roleError);
      res.status(500).json({ error: 'Unable to verify practitioner permissions.' });
      return;
    }

    console.log("✅ Coach role verified");

    const { entryId, replyText } = req.body;
    
    if (!entryId || !replyText || typeof replyText !== "string") {
      console.error("❌ Invalid data:", { entryId: !!entryId, replyText: !!replyText, replyTextType: typeof replyText });
      res.status(400).json({ error: 'Entry ID and reply text are required.' });
      return;
    }

    try {
      const replyRef = admin.firestore()
        .collection("journalEntries")
        .doc(entryId)
        .collection("coachReplies")
        .doc(coachUid);

      await replyRef.set({
        replyText,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        coachUid
      });

      await admin.firestore()
        .collection("journalEntries")
        .doc(entryId)
        .update({ newCoachReply: true });

      console.log("✅ Coach reply saved successfully");
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("❌ Error saving coach reply:", error);
      res.status(500).json({ 
        error: 'Unable to save the practitioner reply right now. Please try again.',
        code: 'SAVE_ERROR',
        retryable: true 
      });
    }
  } catch (error) {
    console.error("❌ Unexpected error in saveCoachReplyHTTP:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Keep the original callable function as backup
exports.saveCoachReply = onCall({
  cors: true
}, async (data, context) => {
  console.log("🔍 saveCoachReply called with:", {
    hasAuth: !!context.auth,
    uid: context.auth?.uid,
    dataKeys: Object.keys(data || {}),
    hasEntryId: !!data?.entryId,
    hasReplyText: !!data?.replyText
  });

  const coachUid = context.auth?.uid;
  if (!coachUid) {
    console.error("❌ No authenticated user found");
    throw new HttpsError("unauthenticated", "Coach must be authenticated.");
  }

  console.log("✅ User authenticated, checking coach role for UID:", coachUid);

  // Verify the user has coach role
  try {
    const userDoc = await admin.firestore().collection("users").doc(coachUid).get();
    console.log("📋 User document exists:", userDoc.exists);
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log("👤 User data:", {
        userRole: userData?.userRole,
        email: userData?.email
      });
    }
    
    if (!userDoc.exists || userDoc.data()?.userRole !== "coach") {
      console.error("❌ User does not have coach role");
      throw new HttpsError("permission-denied", "User does not have coach permissions.");
    }
  } catch (roleError) {
    console.error("❌ Error checking coach role:", roleError);
    if (roleError.code === "permission-denied") {
      throw roleError;
    }
    throw new HttpsError("internal", "Unable to verify coach permissions.");
  }

  console.log("✅ Coach role verified");

  const { entryId, replyText } = data;
  if (!entryId || !replyText || typeof replyText !== "string") {
    console.error("❌ Invalid data:", { entryId: !!entryId, replyText: !!replyText, replyTextType: typeof replyText });
    throw new HttpsError("invalid-argument", "Entry ID and reply text are required.");
  }

  try {
    const replyRef = admin.firestore()
      .collection("journalEntries")
      .doc(entryId)
      .collection("coachReplies")
      .doc(coachUid);

    await replyRef.set({
      replyText,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      coachUid
    });

    await admin.firestore()
      .collection("journalEntries")
      .doc(entryId)
      .update({ newCoachReply: true });

    console.log("✅ Coach reply saved successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ Error saving coach reply:", error);
    throw new HttpsError("internal", "Unable to save the coach reply right now. Please try again.", { 
      code: 'SAVE_ERROR', 
      retryable: true 
    });
  }
});

// Mark coach replies as read
exports.markCoachRepliesAsRead = onCall({
  cors: true
}, async (data, context) => {
  const userId = context.auth?.uid;
  if (!userId) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { entryId } = data;
  if (!entryId) {
    throw new HttpsError("invalid-argument", "Entry ID is required.");
  }

  try {
    // Verify the entry belongs to the authenticated user
    const entryRef = admin.firestore().collection("journalEntries").doc(entryId);
    const entrySnap = await entryRef.get();
    
    if (!entrySnap.exists) {
      throw new HttpsError("not-found", "Journal entry not found.");
    }
    
    const entryData = entrySnap.data();
    if (entryData.userId !== userId) {
      throw new HttpsError("permission-denied", "You can only mark your own entries as read.");
    }

    // Clear the newCoachReply flag
    await entryRef.update({ newCoachReply: false });
    
    console.log(`✅ Marked coach replies as read for entry ${entryId} by user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error marking coach replies as read:", error);
    throw new HttpsError("internal", "Unable to mark replies as read. Please try again.", { 
      code: 'MARK_READ_ERROR', 
      retryable: true 
    });
  }
});


exports.notifyCoachOfTaggedEntry = onRequest({ secrets: [SENDGRID_API_KEY] }, async (req, res) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Coach notification request started`);
  
  // Apply hardened CORS
  if (!setupHardenedCORS(req, res)) {
    console.warn(`[${requestId}] Rejected request from unauthorized origin: ${req.headers.origin}`);
    return res.status(403).send('Forbidden');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return sendSecureErrorResponse(res, 405, 'Method not allowed');
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    let authenticatedUserId = null;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(`[${requestId}] Missing or invalid authorization header`);
      return sendSecureErrorResponse(res, 401, 'Authentication required');
    }
    
    try {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      authenticatedUserId = decodedToken.uid;
      console.log(`[${requestId}] User authenticated: ${authenticatedUserId}`);
    } catch (authError) {
      console.error(`[${requestId}] Authentication failed:`, authError.message);
      return sendSecureErrorResponse(res, 401, 'Invalid authentication token');
    }

    // Validate SendGrid API key (more lenient for local development)
    const apiKey = SENDGRID_API_KEY.value();
    if (!apiKey) {
      console.error(`[${requestId}] SendGrid API key is missing - this is expected in local development`);
      
      // In local development, simulate success for testing purposes
      if (process.env.NODE_ENV !== 'production' && (req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1'))) {
        console.log(`[${requestId}] Local development mode - simulating successful email send`);
        
        const { entryId } = req.body || {};
        if (entryId) {
          // Still update the entry to mark as notified
          await admin.firestore().collection("journalEntries").doc(entryId).update({
            coachNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        return res.status(200).json({ message: "Coach notified successfully (simulated in local dev)" });
      }
      
      return sendSecureErrorResponse(res, 500, 'Email service configuration error');
    }
    
    if (!apiKey.startsWith("SG.")) {
      console.error(`[${requestId}] SendGrid API key format is invalid`);
      return sendSecureErrorResponse(res, 500, 'Email service configuration error');
    }

    sgMail.setApiKey(apiKey);
    console.log(`[${requestId}] SendGrid API key configured`);

    const { entryId, userId } = req.body || {};
    console.log(`[${requestId}] Payload received:`, { entryId, userId });

    if (!entryId) {
      console.error(`[${requestId}] Missing entryId for journal entry notification`);
      return sendSecureErrorResponse(res, 400, 'Missing entry ID');
    }

    // Verify user owns the entry or is authorized
    if (userId && userId !== authenticatedUserId) {
      console.warn(`[${requestId}] User ${authenticatedUserId} attempted to notify for entry owned by ${userId}`);
      return sendSecureErrorResponse(res, 403, 'Not authorized to notify for this entry');
    }

    const coachEmail = "coach@inkwelljournal.io";
    const timestampNote = `<p style="font-size:0.85em; color:#777;">This message was sent at: ${new Date().toLocaleString()}</p>`;

    // Load the journal entry
    const entryDoc = await admin.firestore().collection("journalEntries").doc(entryId).get();
    if (!entryDoc.exists) {
      console.error(`[${requestId}] Entry not found in Firestore for ID: ${entryId}`);
      return sendSecureErrorResponse(res, 404, 'Entry not found');
    }

    const entry = entryDoc.data();
    
    // Verify the entry belongs to the authenticated user
    if (entry.userId !== authenticatedUserId) {
      console.warn(`[${requestId}] Entry ${entryId} belongs to ${entry.userId}, not ${authenticatedUserId}`);
      return sendSecureErrorResponse(res, 403, 'Not authorized to notify for this entry');
    }
    // Check throttling - don't send duplicate notifications
    const lastNotified = entry?.coachNotifiedAt?.toDate?.();
    if (lastNotified && Date.now() - lastNotified.getTime() < 10 * 60 * 1000) {
      console.warn(`[${requestId}] Email already sent recently. Skipping notification.`);
      return res.status(200).json({ message: "Already notified recently" });
    }

    const dateStr = entry.createdAt?.toDate?.().toLocaleString?.() || "Unknown date";
    const manifest = entry.contextManifest || "";
    const entryText = entry.text?.substring(0, 1000) || "(No content)";

    const msg = {
      to: coachEmail,
      from: "support@inkwelljournal.io",
      subject: "New Journal Entry Tagged for Practitioner Review",
      text: `Hi,

A new journal entry was tagged for your review on ${dateStr}.

${manifest ? `Manifest: ${manifest}\n\n` : ""}Entry Preview:

${entryText}

Reply: https://inkwelljournal.io/coach.html?entryId=${entryId}

– InkWell by Pegasus Realm`,
      html: `
        <p><strong>Hi,</strong></p>
        <p>A new entry has been tagged for your review on <strong>${dateStr}</strong>.</p>
        ${manifest ? `<p><strong>Manifest:</strong> ${manifest}</p>` : ""}
        <p><strong>Journal Entry Preview:</strong></p>
        <blockquote style="background:#f9f9f9;padding:1em;border-left:4px solid #FFA76D;">
          ${(entryText || "").replace(/\n/g, "<br/>")}
        </blockquote>
        <p><a href="https://inkwelljournal.io/coach.html?entryId=${entryId}">Click here to reply</a></p>
        ${timestampNote}
        <hr/>
        <p style="font-size:0.9em;color:#777;">
          InkWell by Pegasus Realm • <a href="mailto:support@inkwelljournal.io">support@inkwelljournal.io</a>
        </p>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log(`[${requestId}] Email sent successfully to: ${coachEmail}`);
    } catch (sendError) {
      console.error(`[${requestId}] SendGrid email failed:`, {
        message: sendError.message,
        code: sendError.code,
        response: sendError.response?.body
      });
      
      // Check if it's a billing/credits issue
      const errorBody = sendError.response?.body;
      const isCreditsIssue = errorBody && (
        JSON.stringify(errorBody).includes('billing') ||
        JSON.stringify(errorBody).includes('credit') ||
        JSON.stringify(errorBody).includes('quota') ||
        JSON.stringify(errorBody).includes('limit')
      );
      
      if (isCreditsIssue) {
        console.warn(`[${requestId}] SendGrid billing/credits issue - marking entry but not sending email`);
        
        // Still update the entry to prevent repeated attempts
        await admin.firestore().collection("journalEntries").doc(entryId).update({
          coachNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          coachNotificationStatus: 'pending_billing_resolution'
        });
        
        // Return success to user but log the issue
        console.log(`[${requestId}] Coach notification marked as pending due to billing issue`);
        return res.status(200).json({ 
          message: "Entry saved successfully. Coach notification will be sent once service is restored.",
          status: "pending"
        });
      }
      
      return sendSecureErrorResponse(res, 502, 'Email service temporarily unavailable', sendError);
    }

    // Update entry with notification timestamp
    await admin.firestore().collection("journalEntries").doc(entryId).update({
      coachNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[${requestId}] Coach notification completed successfully`);
    return res.status(200).json({ message: "Coach notified successfully" });
    
  } catch (err) {
    console.error(`[${requestId}] Coach notification failed:`, {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    
    // Return appropriate error based on error type
    if (err.message.includes('auth')) {
      return sendSecureErrorResponse(res, 401, 'Authentication failed', err);
    } else if (err.message.includes('not found')) {
      return sendSecureErrorResponse(res, 404, 'Entry not found', err);
    } else if (err.message.includes('SendGrid') || err.message.includes('email')) {
      return sendSecureErrorResponse(res, 502, 'Email service temporarily unavailable', err);
    } else {
      return sendSecureErrorResponse(res, 500, 'Failed to notify coach', err);
    }
  }
});


// Create user profile if not exists (callable)
exports.createUserProfile = onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  const { email } = data;
  if (!email || typeof email !== "string") {
    throw new HttpsError("invalid-argument", "Email is required.");
  }
  try {
    const result = await createUserProfileIfNotExists(uid, email);
    return { success: true, created: result.created };
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw new HttpsError("internal", "Unable to create your profile right now. Please try again.", { 
      code: 'PROFILE_ERROR', 
      retryable: true 
    });
  }
});

// Verify reCAPTCHA token (callable)
exports.verifyRecaptcha = onCall({ secrets: [RECAPTCHA_SECRET_KEY] }, async (request) => {
  console.log("🔐 verifyRecaptcha called with data:", JSON.stringify(request.data));
  const { token } = request.data;
  
  if (!token) {
    console.error("❌ No token provided in request.data:", request.data);
    throw new HttpsError("invalid-argument", "reCAPTCHA token is required.");
  }

  try {
    console.log("🌐 Making request to Google reCAPTCHA API...");
    
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${RECAPTCHA_SECRET_KEY.value()}&response=${token}`,
    });

    console.log("📡 Got response from Google, status:", response.status);
    
    if (!response.ok) {
      throw new Error(`Google API returned status ${response.status}`);
    }

    const result = await response.json();
    console.log("🔍 Google reCAPTCHA API response:", result);
    
    if (!result.success) {
      console.warn("❌ reCAPTCHA verification failed:", result["error-codes"]);
      throw new HttpsError("permission-denied", `reCAPTCHA verification failed: ${result["error-codes"]?.join(", ") || "Unknown error"}`);
    }

    console.log("✅ reCAPTCHA verification successful");
    return { success: true };
    
  } catch (error) {
    console.error("❌ reCAPTCHA verification error:", error);
    
    // If it's already an HttpsError, re-throw it
    if (error.code) {
      throw error;
    }
    
    // Otherwise wrap it as an internal error
    throw new HttpsError("internal", `reCAPTCHA verification service error: ${error.message}`);
  }
});

// Send practitioner invitation email
exports.sendPractitionerInvitation = onRequest({ secrets: [SENDGRID_API_KEY] }, async (req, res) => {
  // Set CORS headers for both domains
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://inkwell-alpha.web.app',
    'https://inkwelljournal.io',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Get user info
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const userName = userData.signupUsername || userData.displayName || userData.email || 'InkWell User';

    const apiKey = SENDGRID_API_KEY.value();
    sgMail.setApiKey(apiKey);

    const { practitionerEmail, practitionerName } = req.body;

    // Create unique invitation token
    const invitationToken = Math.random().toString(36).substring(2, 15) + 
                           Math.random().toString(36).substring(2, 15);

    // Save invitation to Firestore
    await admin.firestore().collection("practitionerInvitations").doc(invitationToken).set({
      fromUserId: userId,
      fromUserName: userName,
      fromUserEmail: userData.email,
      practitionerEmail: practitionerEmail,
      practitionerName: practitionerName,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.FieldValue.serverTimestamp() // Add 30 days in production
    });

    const registrationUrl = `https://inkwelljournal.io/practitioner-register.html?token=${invitationToken}`;

    const emailContent = {
      to: practitionerEmail,
      from: "support@inkwelljournal.io",
      subject: `${userName} has invited you to InkWell - Professional Mental Health Journaling Platform`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://inkwelljournal.io/InkWell-Logo.png" alt="InkWell" style="max-width: 200px;">
          </div>
          
          <h2 style="color: #2A6972; text-align: center;">You've Been Invited to InkWell</h2>
          
          <p style="font-size: 16px; line-height: 1.6;">Hello ${practitionerName},</p>
          
          <p style="font-size: 16px; line-height: 1.6;">
            <strong>${userName}</strong> (${userData.email}) has invited you to join InkWell as their practitioner. 
            InkWell is a professional mental health journaling platform that connects clients with their practitioners.
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2A6972;">
            <h3 style="margin-top: 0; color: #2A6972;">What is InkWell?</h3>
            <ul style="margin: 10px 0;">
              <li>Evidence-based journaling & manifesting platform for mental health and wellness</li>
              <li>Secure communication between clients and practitioners</li>
              <li>Custom built wellness and growth AI-assisted reflection tools (Sophy) to support clients</li>
              <li>Built by mental health professionals for mental health professionals</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6;">
            To get started and connect with ${userName}, please complete your practitioner registration:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" 
               style="background: #2A6972; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Complete Registration
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; line-height: 1.5;">
            This invitation will expire in 30 days. If you have any questions about InkWell or need support, 
            please contact us at <a href="mailto:support@inkwelljournal.io">support@inkwelljournal.io</a>.
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            InkWell by Pegasus Realm LLC<br>
            Professional Mental Health Journaling Platform<br>
            <a href="https://www.inkwelljournal.io">inkwelljournal.io</a>
          </p>
        </div>
      `
    };

    await sgMail.send(emailContent);
    console.log('✅ Practitioner invitation sent to:', practitionerEmail);

    res.json({ success: true, message: 'Invitation sent successfully' });

  } catch (error) {
    console.error('❌ Error sending practitioner invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// File upload function to handle attachments
exports.uploadFile = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // Check authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // Handle multipart form data for file upload
      const busboy = require('busboy');
      const bb = busboy({ headers: req.headers });
      
      let fileData = null;
      let fileName = null;
      let fileType = null;

      bb.on('file', (name, file, info) => {
        fileName = info.filename;
        fileType = info.mimeType;
        const chunks = [];
        
        file.on('data', (data) => {
          chunks.push(data);
        });
        
        file.on('end', () => {
          fileData = Buffer.concat(chunks);
        });
      });

      bb.on('finish', async () => {
        try {
          if (!fileData || !fileName) {
            return res.status(400).json({ error: 'No file uploaded' });
          }

          // Upload to Firebase Storage
          const bucket = admin.storage().bucket();
          const uniqueFileName = `attachments/${Date.now()}_${userId}_${fileName}`;
          const file = bucket.file(uniqueFileName);
          
          await file.save(fileData, {
            metadata: {
              contentType: fileType,
              metadata: {
                uploadedBy: userId,
                originalName: fileName
              }
            }
          });

          // Make file publicly readable (adjust based on your security needs)
          await file.makePublic();
          
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;
          
          res.status(200).json({
            success: true,
            url: publicUrl,
            name: fileName
          });
          
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          res.status(500).json({ error: 'File upload failed' });
        }
      });

      bb.end(req.body);
      
    } catch (error) {
      console.error('Upload function error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }

    // NEW: Notify admin when practitioner registers
exports.notifyAdminOfPractitionerRegistration = onDocumentCreated(
  "practitionerRequests/{requestId}",
  async (event) => {
    try {
      const requestData = event.data.data();
      const requestId = event.params.requestId;
      
      console.log('🔔 New practitioner registration:', requestId);
      
      // Get SendGrid API key
      const apiKey = SENDGRID_API_KEY.value();
      sgMail.setApiKey(apiKey);
      
      // Format the registration date
      const registeredDate = requestData.requestedAt?.toDate?.() 
        ? requestData.requestedAt.toDate().toLocaleString()
        : 'Unknown date';
      
      // Create the admin notification email
      const adminEmail = {
        to: "support@inkwelljournal.io",
        from: "support@inkwelljournal.io",
        subject: `🔔 New Practitioner Registration: ${requestData.fullName || 'Unknown'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://inkwelljournal.io/InkWell-Logo.png" alt="InkWell" style="max-width: 150px;">
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 1.5em; border-radius: 8px; margin-bottom: 2em;">
              <h2 style="margin-top: 0; color: #856404;">🔔 New Practitioner Registration</h2>
              <p style="margin: 0;"><strong>Action Required:</strong> A new practitioner has registered and requires approval.</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 1.5em; border-radius: 8px; margin-bottom: 1.5em;">
              <h3 style="color: #2A6972; margin-top: 0;">Practitioner Details</h3>
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 0.5em; align-items: start;">
                <strong>Name:</strong><span>${requestData.fullName || 'Not provided'}</span>
                <strong>Email:</strong><span>${requestData.email || 'Not provided'}</span>
                <strong>Credentials:</strong><span>${requestData.credentials || 'Not provided'}</span>
                <strong>Practice Type:</strong><span>${requestData.practiceType || 'Not provided'}</span>
                <strong>License #:</strong><span>${requestData.licenseNumber || 'Not provided'}</span>
                <strong>Location:</strong><span>${requestData.practiceLocation || 'Not provided'}</span>
                <strong>Registered:</strong><span>${registeredDate}</span>
              </div>
            </div>
            
            ${requestData.practiceDescription ? `
            <div style="background: #e8f4f8; padding: 1.5em; border-radius: 8px; border-left: 4px solid #2A6972; margin-bottom: 1.5em;">
              <h4 style="color: #2A6972; margin-top: 0;">Practice Description</h4>
              <p style="margin: 0; font-style: italic;">"${requestData.practiceDescription}"</p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://inkwelljournal.io/admin.html" 
                 style="background: #2A6972; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                🔍 Review & Approve Registration
              </a>
            </div>
            
            <div style="background: #f1f3f4; padding: 1em; border-radius: 4px; margin-top: 2em;">
              <p style="margin: 0; font-size: 0.9em; color: #666;">
                <strong>Next Steps:</strong><br>
                1. Click the button above to access the admin dashboard<br>
                2. Review the practitioner's credentials and information<br>
                3. Approve or deny the registration request<br>
                4. The practitioner will be notified via email of your decision
              </p>
            </div>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              InkWell Admin Notification System<br>
              <a href="https://www.inkwelljournal.io">inkwelljournal.io</a>
            </p>
          </div>
        `
      };
      
      // Send the notification email
      await sgMail.send(adminEmail);
      console.log('✅ Admin notification sent for practitioner registration:', requestId);
      
    } catch (error) {
      console.error('❌ Error sending admin notification:', error);
      // Don't throw - we don't want the registration to fail if email fails
    }
  }
);

// Add this function at the end of your index.js file
exports.notifyAdminOfPractitionerRegistration = onDocumentCreated({
  secrets: [SENDGRID_API_KEY]
}, "practitionerRequests/{requestId}", async (event) => {
  try {
    const requestData = event.data.data();
    const requestId = event.params.requestId;
    
    console.log('🔔 New practitioner registration:', requestId);
    
    // Get SendGrid API key
    const apiKey = SENDGRID_API_KEY.value();
    sgMail.setApiKey(apiKey);
    
    // Format the registration date
    const registeredDate = requestData.requestedAt?.toDate?.() 
      ? requestData.requestedAt.toDate().toLocaleString()
      : 'Unknown date';
    
    // Create the admin notification email
    const adminEmail = {
      to: "support@inkwelljournal.io",
      from: "support@inkwelljournal.io",
      subject: `🔔 New Practitioner Registration: ${requestData.fullName || 'Unknown'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://inkwelljournal.io/InkWell-Logo.png" alt="InkWell" style="max-width: 150px;">
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 1.5em; border-radius: 8px; margin-bottom: 2em;">
            <h2 style="margin-top: 0; color: #856404;">🔔 New Practitioner Registration</h2>
            <p style="margin: 0;"><strong>Action Required:</strong> A new practitioner has registered and requires approval.</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 1.5em; border-radius: 8px; margin-bottom: 1.5em;">
            <h3 style="color: #2A6972; margin-top: 0;">Practitioner Details</h3>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 0.5em; align-items: start;">
              <strong>Name:</strong><span>${requestData.fullName || 'Not provided'}</span>
              <strong>Email:</strong><span>${requestData.email || 'Not provided'}</span>
              <strong>Credentials:</strong><span>${requestData.credentials || 'Not provided'}</span>
              <strong>Practice Type:</strong><span>${requestData.practiceType || 'Not provided'}</span>
              <strong>License #:</strong><span>${requestData.licenseNumber || 'Not provided'}</span>
              <strong>Location:</strong><span>${requestData.practiceLocation || 'Not provided'}</span>
              <strong>Registered:</strong><span>${registeredDate}</span>
            </div>
          </div>
          
          ${requestData.practiceDescription ? `
          <div style="background: #e8f4f8; padding: 1.5em; border-radius: 8px; border-left: 4px solid #2A6972; margin-bottom: 1.5em;">
            <h4 style="color: #2A6972; margin-top: 0;">Practice Description</h4>
            <p style="margin: 0; font-style: italic;">"${requestData.practiceDescription}"</p>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://inkwelljournal.io/admin.html" 
               style="background: #2A6972; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              🔍 Review & Approve Registration
            </a>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            InkWell Admin Notification System<br>
            <a href="https://www.inkwelljournal.io">inkwelljournal.io</a>
          </p>
        </div>
      `
    };
     
    // Send the notification email
    await sgMail.send(adminEmail);
    console.log('✅ Admin notification sent for practitioner registration:', requestId);
    
  } catch (error) {
    console.error('❌ Error sending admin notification:', error);
    // Don't throw - we don't want the registration to fail if email fails
  }
});
  });
});

// Delete file from Firebase Storage
exports.deleteFile = onRequest(async (req, res) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Delete file request started`);
  
  // Apply hardened CORS
  if (!setupHardenedCORS(req, res)) {
    console.warn(`[${requestId}] Rejected request from unauthorized origin: ${req.headers.origin}`);
    return res.status(403).send('Forbidden');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return sendSecureErrorResponse(res, 405, 'Method not allowed');
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(`[${requestId}] Missing or invalid authorization header`);
      return sendSecureErrorResponse(res, 401, 'Authentication required');
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log(`[${requestId}] User authenticated: ${decodedToken.uid}`);

    const { filePath } = req.body;
    if (!filePath) {
      console.error(`[${requestId}] Missing filePath in request body`);
      return sendSecureErrorResponse(res, 400, 'File path is required');
    }

    // Validate that the file path belongs to the authenticated user
    // File paths should include the user ID for security
    if (!filePath.includes(decodedToken.uid)) {
      console.warn(`[${requestId}] User ${decodedToken.uid} attempted to delete file not owned by them: ${filePath}`);
      return sendSecureErrorResponse(res, 403, 'Not authorized to delete this file');
    }

    // Delete from Firebase Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    
    try {
      await file.delete();
      console.log(`[${requestId}] File deleted successfully: ${filePath}`);
      return res.status(200).json({ message: 'File deleted successfully' });
    } catch (deleteError) {
      // Check if file doesn't exist (not an error for our purposes)
      if (deleteError.code === 404) {
        console.log(`[${requestId}] File not found (already deleted): ${filePath}`);
        return res.status(200).json({ message: 'File already deleted' });
      }
      
      console.error(`[${requestId}] Storage deletion failed:`, deleteError);
      return sendSecureErrorResponse(res, 500, 'Failed to delete file from storage', deleteError);
    }
    
  } catch (error) {
    console.error(`[${requestId}] Delete file operation failed:`, error);
    
    if (error.message.includes('auth')) {
      return sendSecureErrorResponse(res, 401, 'Authentication failed', error);
    } else {
      return sendSecureErrorResponse(res, 500, 'Failed to delete file', error);
    }
  }
});

// ===== SOPHY'S INSIGHTS SYSTEM =====

// Test function for single user insights (for troubleshooting)
exports.testUserInsights = onCall({
  secrets: [OPENAI_API_KEY, SENDGRID_API_KEY]
}, async (request) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Test insights for user: ${request.auth?.uid}`);
  
  // Verify user is authenticated
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated to test insights');
  }
  
  const userId = request.auth.uid;
  
  try {
    // Get user data
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User profile not found');
    }
    
    const userData = userDoc.data();
    if (!userData.email) {
      throw new HttpsError('failed-precondition', 'User email not found');
    }

    console.log(`[${requestId}] Generating test weekly insights`);
    const weeklyData = await collectWeeklyUserData(userId, requestId);
    
    if (weeklyData.stats.totalEntries === 0) {
      return {
        status: 'skipped', 
        message: 'No journal or manifest entries found for the past 7 days'
      };
    }
    
    const { journalEntries, manifestEntries, stats } = weeklyData;
    
    const insights = await generateInsightsWithOpenAI(
      journalEntries, 
      manifestEntries, 
      stats, 
      'weekly', 
      userData.signupUsername || userData.displayName || 'Friend',
      requestId
    );
    
    await sendInsightsEmail(userData.email, insights, 'weekly', userData.signupUsername || userData.displayName);
    
    return {
      status: 'success',
      message: `Weekly insights sent to ${userData.email}`,
      stats: {
        journalEntries: journalEntries.length,
        manifestEntries: manifestEntries.length,
        totalWords: stats.totalWords,
        daysActive: stats.daysActive
      }
    };
    
  } catch (error) {
    console.error(`[${requestId}] Test insights failed:`, error);
    throw new HttpsError('internal', `Test insights failed: ${error.message}`);
  }
});

// Scheduled function for weekly insights (runs every Monday at 9 AM UTC)
exports.sendWeeklyInsights = onRequest({
  secrets: [OPENAI_API_KEY, SENDGRID_API_KEY],
  cors: ALLOWED_ORIGINS
}, async (req, res) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Weekly insights generation started`);
  
  try {
    setupHardenedCORS(req, res);
    
    if (req.method !== 'POST') {
      return sendSecureErrorResponse(res, 405, 'Method not allowed', null);
    }
    
    await generateAndSendInsights('weekly', requestId);
    res.status(200).json({ success: true, message: 'Weekly insights sent successfully' });
    
  } catch (error) {
    console.error(`[${requestId}] Weekly insights failed:`, error);
    return sendSecureErrorResponse(res, 500, 'Failed to generate weekly insights', error);
  }
});

// Main insights generation function
async function generateAndSendInsights(period, requestId) {
  console.log(`[${requestId}] Starting ${period} insights generation`);
  
  // Get all users with insights enabled
  const usersSnapshot = await admin.firestore().collection('users').get();
  const processedUsers = [];
  
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;
    
    // Check if user has opted in for this period
    const insightsEnabled = period === 'weekly' 
      ? userData.insightsPreferences?.weeklyEnabled 
      : userData.insightsPreferences?.monthlyEnabled;
      
    if (!insightsEnabled || !userData.email) {
      continue;
    }
    
    try {
      console.log(`[${requestId}] Processing ${period} insights for user: ${userId}`);
      
      // Get user's journal entries and manifest entries for the period
      const { journalEntries, manifestEntries, stats } = await getUserDataForPeriod(userId, period);
      
      if (journalEntries.length === 0 && manifestEntries.length === 0) {
        console.log(`[${requestId}] No entries found for user ${userId}, skipping`);
        continue;
      }
      
      // Generate insights using OpenAI
      const insights = await generateInsightsWithOpenAI(
        journalEntries, 
        manifestEntries, 
        stats, 
        period, 
        userData.signupUsername || userData.displayName || 'Friend',
        requestId
      );
      
      // Send email with insights
      await sendInsightsEmail(userData.email, insights, period, userData.signupUsername || userData.displayName);
      
      processedUsers.push(userId);
      console.log(`[${requestId}] Successfully sent ${period} insights to user: ${userId}`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`[${requestId}] Failed to process ${period} insights for user ${userId}:`, error);
      // Continue with other users even if one fails
    }
  }
  
  console.log(`[${requestId}] ${period} insights completed. Processed ${processedUsers.length} users.`);
}

// Single user insights generation (for testing)
async function testGenerateSingleUserInsights(userId, period, requestId) {
  console.log(`[${requestId}] Testing ${period} insights for user: ${userId}`);
  
  try {
    // Get user data
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    if (!userData.email) {
      throw new Error('User email not found');
    }
    
    // Get user's journal entries and manifest entries for the period
    const { journalEntries, manifestEntries, stats } = await getUserDataForPeriod(userId, period);
    
    if (journalEntries.length === 0 && manifestEntries.length === 0) {
      return {
        status: 'skipped',
        message: `No ${period === 'weekly' ? '7-day' : '30-day'} entries found`,
        stats: stats
      };
    }
    
    // Generate insights using OpenAI
    const insights = await generateInsightsWithOpenAI(
      journalEntries, 
      manifestEntries, 
      stats, 
      period, 
      userData.signupUsername || userData.displayName || 'Friend',
      requestId
    );
    
    // Send email with insights
    await sendInsightsEmail(userData.email, insights, period, userData.signupUsername || userData.displayName);
    
    console.log(`[${requestId}] Successfully sent test ${period} insights to user: ${userId}`);
    
    return {
      status: 'success',
      message: 'Email sent successfully',
      stats: stats
    };
    
  } catch (error) {
    console.error(`[${requestId}] Failed to generate test ${period} insights for user ${userId}:`, error);
    return {
      status: 'failed',
      error: error.message,
      stats: { journalEntries: 0, manifestEntries: 0, totalWords: 0, daysActive: 0 }
    };
  }
}

// Get user's data for the specified period
async function getUserDataForPeriod(userId, period) {
  console.log(`Getting data for user ${userId}, period: ${period}`);
  
  // FOR TESTING: Let's check both possible collection names and inspect the data structure
  
  try {
    // Check journals collection
    const journalSnapshot = await admin.firestore()
      .collection('journals')
      .where('userId', '==', userId)
      .limit(50) 
      .get();
      
    console.log(`Found ${journalSnapshot.docs.length} entries in 'journals' collection`);
    
    // Also check journalEntries collection in case that's where the data is
    const journalEntriesSnapshot = await admin.firestore()
      .collection('journalEntries')
      .where('userId', '==', userId)
      .limit(50)
      .get();
      
    console.log(`Found ${journalEntriesSnapshot.docs.length} entries in 'journalEntries' collection`);
    
    // Check manifest entries
    const manifestSnapshot = await admin.firestore()
      .collection('manifests')
      .where('userId', '==', userId)
      .limit(50)
      .get();
      
    console.log(`Found ${manifestSnapshot.docs.length} manifest entries`);
    
    // Debug: Show the actual data structure of found entries
    if (journalSnapshot.docs.length > 0) {
      const firstJournal = journalSnapshot.docs[0].data();
      console.log(`Sample journal data:`, JSON.stringify(firstJournal, null, 2));
    }
    
    if (journalEntriesSnapshot.docs.length > 0) {
      const firstJournalEntry = journalEntriesSnapshot.docs[0].data();
      console.log(`Sample journalEntry data:`, JSON.stringify(firstJournalEntry, null, 2));
    }
    
    if (manifestSnapshot.docs.length > 0) {
      const firstManifest = manifestSnapshot.docs[0].data();
      console.log(`Sample manifest data:`, JSON.stringify(firstManifest, null, 2));
    }
    
    // Use whichever collection has the data
    const actualJournalSnapshot = journalEntriesSnapshot.docs.length > 0 ? journalEntriesSnapshot : journalSnapshot;
    console.log(`Using ${journalEntriesSnapshot.docs.length > 0 ? 'journalEntries' : 'journals'} collection for journal data`);
  
    // FOR TESTING: Use much more lenient date filtering - last 30 days for both weekly and monthly
    const now = new Date();
    const startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // Last 30 days
    
    console.log(`Date filtering: Looking for entries after ${startDate.toISOString()}`);
    
    const journalEntries = actualJournalSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate();
        console.log(`Journal entry ${doc.id}: createdAt = ${createdAt?.toISOString()}, content preview = ${data.content?.substring(0, 50)}...`);
        return {
          id: doc.id,
          ...data,
          createdAt
        };
      })
      .filter(entry => {
        const include = entry.createdAt && entry.createdAt >= startDate;
        console.log(`Journal ${entry.id}: ${include ? 'INCLUDED' : 'EXCLUDED'} (${entry.createdAt?.toISOString()})`);
        return include;
      })
      .sort((a, b) => a.createdAt - b.createdAt);
      
    const manifestEntries = manifestSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate();
        console.log(`Manifest entry ${doc.id}: createdAt = ${createdAt?.toISOString()}, data keys = ${Object.keys(data).join(', ')}`);
        return {
          id: doc.id,
          ...data,
          createdAt
        };
      })
      .filter(entry => {
        const include = entry.createdAt && entry.createdAt >= startDate;
        console.log(`Manifest ${entry.id}: ${include ? 'INCLUDED' : 'EXCLUDED'} (${entry.createdAt?.toISOString()})`);
        return include;
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  
    // Calculate basic stats
    const stats = {
      totalJournalEntries: journalEntries.length,
      totalManifestEntries: manifestEntries.length,
      totalWords: journalEntries.reduce((sum, entry) => 
        sum + (entry.content?.split(/\s+/).length || 0), 0),
      daysActive: new Set([
        ...journalEntries.map(e => e.createdAt?.toDateString()),
        ...manifestEntries.map(e => e.createdAt?.toDateString())
      ].filter(Boolean)).size,
      periodDays: period === 'weekly' ? 7 : 30
    };
    
    console.log(`Final filtered data - Journals: ${journalEntries.length}, Manifests: ${manifestEntries.length}`);
    return { journalEntries, manifestEntries, stats };
    
  } catch (error) {
    console.error('Error in getUserDataForPeriod:', error);
    throw error;
  }
}

// Generate insights using Anthropic Claude
async function generateInsightsWithOpenAI(journalEntries, manifestEntries, stats, period, userName, requestId) {
  console.log(`[${requestId}] Generating ${period} insights for ${userName} with ${stats.totalJournalEntries} journal entries and ${stats.totalManifestEntries} manifest entries`);
  
  // Create content summary (heavily limited to prevent token overflow)
  const journalContent = journalEntries.slice(0, 5) // Limit to 5 most recent entries
    .map(entry => `Date: ${entry.createdAt?.toDateString()}\nEntry: ${entry.content?.substring(0, 200) || ''}`) // Reduced from 600 to 200 chars
    .join('\n\n---\n\n');
    
  const manifestContent = manifestEntries.slice(0, 3) // Limit to 3 most recent manifests  
    .map(entry => `Date: ${entry.createdAt?.toDateString()}\nWish: ${entry.wish?.substring(0, 150) || ''}\nGratitude: ${entry.gratitude?.substring(0, 150) || ''}`) // Reduced from 300 to 150 chars
    .join('\n\n---\n\n');
  
  // Different prompts for weekly vs monthly to ensure different content
  const periodSpecific = period === 'weekly' 
    ? {
        timeframe: 'this past week',
        focus: 'recent patterns and immediate insights from your week',
        approach: 'a quick check-in on your weekly practice'
      }
    : {
        timeframe: 'this past month', 
        focus: 'deeper trends, evolution over time, and comprehensive growth patterns across the month',
        approach: 'a comprehensive reflection on your monthly journey with deeper psychological insights'
      };
  
  // Create a comprehensive prompt that analyzes both journal and manifest data separately
  const hasJournals = journalEntries.length > 0;
  const hasManifests = manifestEntries.length > 0;
  
  let prompt = `You are Sophy, a compassionate AI wellness companion. You're creating a ${period} reflection for ${userName} about ${periodSpecific.timeframe}.

## YOUR ANALYSIS FRAMEWORK:

`;

  // Add journal analysis section if they have journal entries
  if (hasJournals) {
    prompt += `### JOURNAL REFLECTION ANALYSIS:
**Drawing from Gestalt Therapy, Positive Psychology, and Atomic Habits:**

JOURNAL ENTRIES (${stats.totalJournalEntries} entries, ${stats.totalWords} words):
${journalContent}

**Look for:**
- **GESTALT PERSPECTIVE:** Themes of awareness, present-moment experiences, emotional processing patterns, what emerges as figure vs. background
- **POSITIVE PSYCHOLOGY:** Evidence of PERMA (Positive emotions, Engagement, Relationships, Meaning, Achievement), character strengths, resilience, flourishing moments
- **ATOMIC HABITS:** Identity shifts, 1% improvements, habit patterns, system improvements, process vs. outcome focus

`;
  }

  // Add manifest analysis section if they have manifest entries  
  if (hasManifests) {
    prompt += `### MANIFEST REFLECTION ANALYSIS:
**Using the WISH Framework (Want → Imagine → Snags → How):**

MANIFEST ENTRIES (${stats.totalManifestEntries} entries):
${manifestContent}

**Look for:**
- **WANT:** Clarity and realistic goal-setting patterns
- **IMAGINE:** How they visualize success and emotional outcomes  
- **SNAGS:** Their awareness of obstacles and challenges
- **HOW:** Their problem-solving and backup planning abilities
- **Progress:** Celebration of small steps, effort over results

`;
  }

  prompt += `## YOUR RESPONSE STRUCTURE:

**WARM GREETING** 
Acknowledge their ${periodSpecific.timeframe} commitment (${stats.daysActive} active days)

**WEEKLY SNAPSHOT** (Brief data summary in supportive tone)
- ${stats.totalJournalEntries} journal entries with ${stats.totalWords} words written${hasManifests ? `\n- ${stats.totalManifestEntries} WISH manifestations explored` : ''}
- Present this as celebration of their consistency and engagement

`;

  if (hasJournals) {
    prompt += `**JOURNAL INSIGHTS** (2-3 key observations)
- What themes, emotions, or awareness patterns emerge?
- Which growth moments or strengths do you notice?
- What habit or identity shifts are taking root?

`;
  }

  if (hasManifests) {
    prompt += `**MANIFESTING PATTERNS** (Focus on their WISH process)
- How clear and realistic are their wants?
- What does their visualization reveal about their values?
- How well do they anticipate and plan for obstacles?
- What progress or effort deserves celebration?

`;
  }

  prompt += `**GENTLE ENCOURAGEMENT**
Connect insights to their journey ahead, focusing on building on existing strengths

## YOUR VOICE:
- Speak directly and warmly - be genuinely personal
- Reference specific content from their entries
- Celebrate progress while acknowledging struggles with compassion
- Use their own language and themes when possible
- ${period === 'monthly' ? '200-300 words total - deeper reflection with more comprehensive insights' : '150-200 words total'}
- Focus on what you actually observe, not generic advice
${period === 'monthly' ? '- For monthly: Look for longer-term patterns, evolution over time, and deeper psychological insights' : ''}
- DO NOT include any signature or sign-off - the email template handles that

Make them feel truly seen and understood based on their actual content.`;
  try {
    // Enhanced logging for debugging
    console.log(`[${requestId}] Starting AI generation for ${period} insights...`);
    console.log(`[${requestId}] Data summary: ${journalEntries.length} journals, ${manifestEntries.length} manifests`);
    
    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      console.error(`[${requestId}] ❌ OpenAI API key not found in secrets`);
      throw new Error('OpenAI API key not found');
    }
    
    console.log(`[${requestId}] ✅ OpenAI API key found (${apiKey.length} chars)`);
    
    // Log a sample of the content we're sending
    if (journalContent) {
      console.log(`[${requestId}] Sample journal content: ${journalContent.substring(0, 200)}...`);
    }
    
    console.log(`[${requestId}] Making OpenAI API request...`);
    console.log(`[${requestId}] Prompt length: ${prompt.length} characters`);
    console.log(`[${requestId}] Prompt preview: ${prompt.substring(0, 300)}...`);
    
    const requestBody = {
      model: 'gpt-4o-mini', // Using GPT-4o mini for cost efficiency
      max_tokens: 2000, // Increased to allow for comprehensive Gestalt/WISH responses
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7
    };
    
    console.log(`[${requestId}] Request body prepared, making fetch call...`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`[${requestId}] OpenAI API response received with status: ${response.status}`);
    console.log(`[${requestId}] Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] ❌ OpenAI API error ${response.status}: ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    console.log(`[${requestId}] Reading response body...`);
    const result = await response.json();
    console.log(`[${requestId}] ✅ Response parsed successfully`);
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error(`[${requestId}] ❌ Unexpected OpenAI response structure:`, JSON.stringify(result, null, 2));
      throw new Error('Unexpected OpenAI response format');
    }
    
    const rawInsights = result.choices[0].message.content;
    console.log(`[${requestId}] ✅ Generated ${period} insights successfully (${rawInsights.length} characters)`);
    console.log(`[${requestId}] Insights preview: ${rawInsights.substring(0, 150)}...`);
    
    // Clean up markdown formatting and add signature
    const cleanedInsights = rawInsights
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold** formatting
      .replace(/\*(.*?)\*/g, '$1')     // Remove *italic* formatting 
      .replace(/#{1,6}\s+/g, '')       // Remove markdown headers
      .trim();
    
    // Add proper signature from Sophy and the Inkwell team
    const signedInsights = `${cleanedInsights}

Keep up the great work—every small step counts.
Sophy & The Inkwell Team ✨`;
    
    return signedInsights;
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error generating ${period} insights:`, error.message);
    console.error(`[${requestId}] Full error details:`, error);
    
    // Enhanced period-specific fallback with clear indication
    const periodText = period === 'weekly' ? 'week' : 'month';
    const timeframe = period === 'weekly' ? 'this week' : 'this month';
    const encouragement = period === 'weekly' 
      ? `This week's practice shows your dedication to consistent self-care. Each entry is a gift to your future self!` 
      : `This month's journey demonstrates your ongoing commitment to personal growth. These regular practices are building something beautiful.`;
    
    return `[FALLBACK MODE - OpenAI API failed: ${error.message}] 

Hi ${userName}! 

I wanted to reach out with your ${periodText}ly reflection. I can see you've been showing up for yourself with ${stats.totalJournalEntries + stats.totalManifestEntries} entries across ${stats.daysActive} days ${timeframe}.

That commitment to self-reflection is truly meaningful. Each time you write, you're creating space for growth and understanding.

${encouragement}

Keep nurturing this beautiful practice - your future self will thank you for these moments of mindfulness and intention.

With warmth,
Sophy ✨`;
  }
}

// Send insights email via SendGrid
async function sendInsightsEmail(userEmail, insights, period, userName) {
  console.log(`📧 Attempting to send ${period} insights email to ${userEmail}`);
  
  // Check if SendGrid API key is available
  const apiKey = SENDGRID_API_KEY.value();
  if (!apiKey) {
    console.error('❌ SendGrid API key is missing');
    throw new Error('SendGrid API key not configured');
  }
  
  if (!apiKey.startsWith("SG.")) {
    console.error('❌ SendGrid API key format is invalid');
    throw new Error('SendGrid API key format invalid');
  }
  
  console.log('✅ SendGrid API key is properly configured');
  sgMail.setApiKey(apiKey);
  
  // Different visual themes for weekly vs monthly
  const theme = period === 'weekly' 
    ? {
        headerColor: '#2A6972',
        gradientStart: '#f0f8ff',
        gradientEnd: '#f8ffff',
        borderColor: '#2A6972',
        icon: '✨',
        subtitle: 'Your weekly reflection from Sophy'
      }
    : {
        headerColor: '#D49489',
        gradientStart: '#fff8f5',
        gradientEnd: '#fef6f4',
        borderColor: '#D49489',
        icon: '�',
        subtitle: 'Your monthly journey insights from Sophy'
      };
  
  const subject = period === 'weekly' 
    ? `Your Weekly Reflection from Sophy ${theme.icon}` 
    : `Your Monthly Journey Insights from Sophy ${theme.icon}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>InkWell Insights</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fafafa;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: ${theme.headerColor}; font-size: 1.8em; margin-bottom: 10px; font-weight: 600;">InkWell Insights</h1>
        <p style="color: #666; font-size: 0.9em; margin: 0;">${theme.subtitle}</p>
      </div>
      
      <div style="background: linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%); padding: 30px; border-radius: 12px; border-left: 4px solid ${theme.borderColor}; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="white-space: pre-line; font-size: 1em; line-height: 1.7; color: #2d2d2d;">${insights}</div>
      </div>
      
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.85em;">
        <p style="margin-bottom: 10px;">This email was sent because you opted in to receive ${period} insights in your InkWell settings.</p>
        <p style="margin: 0;"><a href="https://inkwelljournal.io" style="color: ${theme.headerColor}; text-decoration: none; font-weight: 500;">Visit InkWell</a> • <a href="#" style="color: #666; text-decoration: none;">Manage Preferences</a></p>
      </div>
    </body>
    </html>
  `;
  
  const msg = {
    to: userEmail,
    from: {
      email: 'sophy@inkwelljournal.io',
      name: 'Sophy from InkWell'
    },
    subject: subject,
    html: htmlContent,
    text: insights // Plain text fallback
  };
  
  console.log('📨 Sending email with config:', {
    to: userEmail,
    from: 'sophy@inkwelljournal.io',
    subject: subject
  });
  
  try {
    const result = await sgMail.send(msg);
    console.log('✅ SendGrid email sent successfully:', result[0].statusCode);
    return result;
  } catch (error) {
    console.error('❌ SendGrid send failed:', error);
    console.error('❌ SendGrid error details:', error.response?.body || error.message);
    throw error;
  }
}

// Monthly-specific email function with coral theme
async function sendMonthlyInsightsEmail(userEmail, insights, period, userName) {
  console.log(`📧 Attempting to send ${period} insights email to ${userEmail}`);
  
  // Check if SendGrid API key is available
  const apiKey = SENDGRID_API_KEY.value();
  if (!apiKey) {
    console.error('❌ SendGrid API key is missing');
    throw new Error('SendGrid API key not configured');
  }
  
  if (!apiKey.startsWith("SG.")) {
    console.error('❌ SendGrid API key format is invalid');
    throw new Error('SendGrid API key format invalid');
  }
  
  console.log('✅ SendGrid API key is properly configured');
  sgMail.setApiKey(apiKey);
  
  // Coral theme for monthly insights
  const theme = {
    headerColor: '#D49489',
    gradientStart: '#fff8f5',
    gradientEnd: '#fef6f4',
    borderColor: '#D49489',
    accentColor: '#E6A497',
    icon: '🌺',
    subtitle: 'Your monthly journey insights from Sophy'
  };
  
  const subject = `Your Monthly Journey Insights from Sophy ${theme.icon}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>InkWell Monthly Insights</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fafafa;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: ${theme.headerColor}; font-size: 1.8em; margin-bottom: 10px; font-weight: 600;">InkWell Monthly Insights</h1>
        <p style="color: #666; font-size: 0.9em; margin: 0;">${theme.subtitle}</p>
      </div>
      
      <div style="background: linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%); padding: 30px; border-radius: 12px; border-left: 4px solid ${theme.borderColor}; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(212, 148, 137, 0.15);">
        <div style="white-space: pre-line; font-size: 1em; line-height: 1.7; color: #2d2d2d;">${insights}</div>
      </div>
      
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid ${theme.accentColor}; color: #666; font-size: 0.85em;">
        <p style="margin-bottom: 10px;">This email was sent because you opted in to receive monthly insights in your InkWell settings.</p>
        <p style="margin: 0;"><a href="https://inkwelljournal.io" style="color: ${theme.headerColor}; text-decoration: none; font-weight: 500;">Visit InkWell</a> • <a href="#" style="color: #666; text-decoration: none;">Manage Preferences</a></p>
      </div>
    </body>
    </html>
  `;
  
  const msg = {
    to: userEmail,
    from: {
      email: 'sophy@inkwelljournal.io',
      name: 'Sophy from InkWell'
    },
    subject: subject,
    html: htmlContent,
    text: insights // Plain text fallback
  };
  
  console.log('📨 Sending monthly email with config:', {
    to: userEmail,
    from: 'sophy@inkwelljournal.io',
    subject: subject
  });
  
  try {
    const result = await sgMail.send(msg);
    console.log('✅ SendGrid monthly email sent successfully:', result[0].statusCode);
    return result;
  } catch (error) {
    console.error('❌ SendGrid monthly send failed:', error);
    console.error('❌ SendGrid monthly error details:', error.response?.body || error.message);
    throw error;
  }
}

// Collect user's weekly data from Firestore
async function collectWeeklyUserData(userId, requestId) {
  console.log(`[${requestId}] 📊 Collecting weekly data for user: ${userId}`);
  
  try {
    // Calculate date range for the past week (Monday to Sunday)
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    console.log(`[${requestId}] Date range: ${oneWeekAgo.toISOString()} to ${now.toISOString()}`);
    
    // Get user's journal entries from the past week - simplified query first
    console.log(`[${requestId}] 📊 Querying journal entries for ${userId} since ${oneWeekAgo.toISOString()}`);
    const journalEntriesRef = admin.firestore().collection('journalEntries');
    
    // Try simple query first to test connectivity
    let journalSnapshot;
    try {
      journalSnapshot = await journalEntriesRef
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(100)  // Get recent entries and filter by date after
        .get();
      
      console.log(`[${requestId}] 📝 Found ${journalSnapshot.size} total journal entries for user`);
    } catch (queryError) {
      console.error(`[${requestId}] ❌ Journal query failed:`, queryError);
      throw new Error(`Journal query failed: ${queryError.message}`);
    }
    
    
    // Get user's WISH/manifest entries from the past week - direct document access
    console.log(`[${requestId}] 📊 Accessing manifest document for ${userId} since ${oneWeekAgo.toISOString()}`);
    
    let manifestSnapshot;
    try {
      // Manifests are stored as a single document per user, not a collection
      const manifestDocRef = admin.firestore().collection('manifests').doc(userId);
      const manifestDoc = await manifestDocRef.get();
      
      if (manifestDoc.exists) {
        // Create a mock snapshot structure for consistency
        manifestSnapshot = {
          size: 1,
          docs: [manifestDoc]
        };
        console.log(`[${requestId}] 🎯 Found manifest document for user`);
      } else {
        manifestSnapshot = { size: 0, docs: [] };
        console.log(`[${requestId}] 📝 No manifest document found for user`);
      }
    } catch (queryError) {
      console.error(`[${requestId}] ❌ Manifest query failed:`, queryError);
      throw new Error(`Manifest query failed: ${queryError.message}`);
    }
    
    // Process journal entries and filter by date range
    const journalEntries = [];
    const journalDates = new Set();
    
    journalSnapshot.forEach(doc => {
      try {
        const entry = doc.data();
        console.log(`[${requestId}] 📝 Processing journal entry ${doc.id}, createdAt type:`, typeof entry.createdAt, entry.createdAt);
        
        // Safely handle createdAt date conversion
        if (entry.createdAt && typeof entry.createdAt.toDate === 'function') {
          const entryDate = entry.createdAt.toDate();
          console.log(`[${requestId}] ✅ Converted date:`, entryDate);
          
          // Filter by date range in JavaScript
          if (entryDate && entryDate >= oneWeekAgo && entryDate <= now) {
            journalEntries.push({
              id: doc.id,
              text: entry.text || '',
              createdAt: entry.createdAt,
              contextManifest: entry.contextManifest || ''
            });
            
            // Track unique days for statistics
            journalDates.add(entryDate.toDateString());
            console.log(`[${requestId}] ✅ Added journal entry from ${entryDate.toDateString()}`);
          } else {
            console.log(`[${requestId}] ⏭️ Journal entry outside date range: ${entryDate}`);
          }
        } else {
          console.log(`[${requestId}] ⚠️ Journal entry has invalid createdAt:`, entry.createdAt);
        }
      } catch (error) {
        console.error(`[${requestId}] ❌ Error processing journal entry ${doc.id}:`, error);
        // Continue processing other entries
      }
    });
    
    console.log(`[${requestId}] ✅ Filtered to ${journalEntries.length} journal entries from past week`);
    
    // Process WISH/manifest document (single doc per user)
    const manifestEntries = [];
    const manifestDates = new Set();
    
    manifestSnapshot.docs.forEach(doc => {
      const manifestData = doc.data();
      
      // Check if there's a recent update to the manifest
      if (manifestData.createdAt || manifestData.updatedAt) {
        const relevantDate = manifestData.updatedAt || manifestData.createdAt;
        if (relevantDate && typeof relevantDate.toDate === 'function') {
          const entryDate = relevantDate.toDate();
          
          // Filter by date range in JavaScript
          if (entryDate && entryDate >= oneWeekAgo && entryDate <= now) {
            manifestEntries.push({
              id: doc.id,
              text: manifestData.text || manifestData.content || '',
              createdAt: relevantDate,
              type: 'manifest'
            });
            
            // Track unique days for statistics
            manifestDates.add(entryDate.toDateString());
          }
        }
      }
    });
    
    console.log(`[${requestId}] ✅ Filtered to ${manifestEntries.length} manifest entries from past week`);
    
    // Calculate statistics
    const allDates = new Set([...journalDates, ...manifestDates]);
    const stats = {
      totalJournalEntries: journalEntries.length,
      totalManifestEntries: manifestEntries.length,
      totalEntries: journalEntries.length + manifestEntries.length,
      daysActive: allDates.size,
      journalDaysActive: journalDates.size,
      manifestDaysActive: manifestDates.size
    };
    
    console.log(`[${requestId}] ✅ Weekly data collected:`, stats);
    
    return {
      journalEntries,
      manifestEntries,
      stats,
      dateRange: {
        start: oneWeekAgo,
        end: now
      }
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error collecting weekly data for user ${userId}:`, error);
    throw error;
  }
}

// Main function to process weekly insights for all eligible users
async function processWeeklyInsights(requestId) {
  console.log(`[${requestId}] 🚀 Starting weekly insights processing`);
  
  try {
    // Get all users who have weekly insights enabled
    const usersRef = admin.firestore().collection('users');
    const usersSnapshot = await usersRef
      .where('insightsPreferences.weeklyEnabled', '==', true)
      .get();
    
    console.log(`[${requestId}] Found ${usersSnapshot.size} users with weekly insights enabled`);
    
    const processedUsers = [];
    const errors = [];
    
    // Process each user sequentially to avoid overwhelming APIs
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const userEmail = userData.email;
      const userName = userData.displayName || userData.signupUsername || 'Friend';
      
      try {
        console.log(`[${requestId}] 📝 Processing weekly insights for ${userId} (${userEmail})`);
        console.log(`[${requestId}] 👤 User role: ${userData.userRole}`);
        console.log(`[${requestId}] ⚙️ Weekly enabled: ${userData.insightsPreferences?.weeklyEnabled}`);
        
        // Collect user's weekly data
        console.log(`[${requestId}] 📊 Collecting weekly data for ${userId}...`);
        const weeklyData = await collectWeeklyUserData(userId, requestId);
        console.log(`[${requestId}] ✅ Data collection completed for ${userId}:`, weeklyData.stats);
        
        // Skip users with no activity this week
        if (weeklyData.stats.totalEntries === 0) {
          console.log(`[${requestId}] ⏭️ Skipping ${userId} - no activity this week`);
          continue;
        }
        
        // Generate insights using OpenAI
        const insights = await generateInsightsWithOpenAI(
          weeklyData.journalEntries,
          weeklyData.manifestEntries,
          weeklyData.stats,
          'weekly',
          userName,
          requestId
        );
        
        // Send email with insights
        await sendInsightsEmail(userEmail, insights, 'weekly', userName);
        
        processedUsers.push({
          userId,
          email: userEmail,
          stats: weeklyData.stats
        });
        
        console.log(`[${requestId}] ✅ Weekly insights sent successfully to ${userEmail}`);
        
        // Add small delay between users to be respectful to APIs
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (userError) {
        console.error(`[${requestId}] ❌ Error processing user ${userId}:`, userError);
        errors.push({
          userId,
          email: userEmail,
          error: userError.message
        });
      }
    }
    
    console.log(`[${requestId}] 🎉 Weekly insights processing completed`);
    console.log(`[${requestId}] Successfully processed: ${processedUsers.length} users`);
    console.log(`[${requestId}] Errors: ${errors.length} users`);
    
    return {
      success: true,
      processedUsers,
      errors,
      totalEligible: usersSnapshot.size
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Fatal error in weekly insights processing:`, error);
    throw error;
  }
}

// Scheduled function to send weekly insights every Monday at 9 AM Hawaii time (UTC-10)
exports.weeklyInsightsScheduler = onSchedule({
  schedule: "0 19 * * 1", // Every Monday at 19:00 UTC (9:00 AM Hawaii time UTC-10)
  timeZone: "Pacific/Honolulu", // Hawaii timezone
  secrets: [OPENAI_API_KEY, SENDGRID_API_KEY]
}, async (event) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] 📅 Weekly insights scheduled function triggered`);
  
  try {
    const result = await processWeeklyInsights(requestId);
    console.log(`[${requestId}] ✅ Scheduled weekly insights completed:`, result);
    return result;
  } catch (error) {
    console.error(`[${requestId}] ❌ Scheduled weekly insights failed:`, error);
    throw error;
  }
});

// GHOST-FREE WEEKLY INSIGHTS - Completely new function to avoid all legacy code
async function ghostFreeWeeklyInsights(requestId) {
  console.log(`[${requestId}] 👻 Starting GHOST-FREE weekly insights`);
  
  try {
    // Get users with weekly insights enabled - simple query
    const usersRef = admin.firestore().collection('users');
    const usersSnapshot = await usersRef.get();
    
    console.log(`[${requestId}] Found ${usersSnapshot.size} total users`);
    
    const processedUsers = [];
    const errors = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Check if weekly insights enabled
      if (!userData.insightsPreferences?.weeklyEnabled) {
        console.log(`[${requestId}] Skipping ${userId} - weekly insights not enabled`);
        continue;
      }
      
      try {
        console.log(`[${requestId}] Processing user ${userId} (${userData.email})`);
        
        // Get recent journal entries - ULTRA SIMPLE approach (no orderBy to avoid index issues)
        const journalRef = admin.firestore().collection('journalEntries');
        const journalDocs = await journalRef
          .where('userId', '==', userId)
          .limit(50) // Get more entries since we can't order, then sort manually
          .get();
        
        console.log(`[${requestId}] Found ${journalDocs.size} journal entries for ${userId}`);
        
        // Skip if no activity
        if (journalDocs.size === 0) {
          console.log(`[${requestId}] Skipping ${userId} - no journal entries`);
          continue;
        }
        
        // Get manifest entries too for complete insights - ULTRA SIMPLE approach
        const manifestRef = admin.firestore().collection('manifests');
        const manifestDocs = await manifestRef
          .where('userId', '==', userId)
          .limit(20) // Get more then sort manually  
          .get();
          
        console.log(`[${requestId}] Found ${manifestDocs.size} manifest entries for ${userId}`);
        
        // Prepare data for OpenAI analysis
        const entryCount = journalDocs.size;
        const userName = userData.displayName || userData.signupUsername || 'Friend';
        
        // Convert Firestore documents to arrays and sort manually by date (most recent first)
        const journalEntries = journalDocs.docs
          .map(doc => ({
            content: doc.data().content,
            createdAt: doc.data().createdAt?.toDate()
          }))
          .filter(entry => entry.createdAt) // Filter out entries without dates
          .sort((a, b) => b.createdAt - a.createdAt) // Sort by date desc
          .slice(0, 20); // Take most recent 20
        
        const manifestEntries = manifestDocs.docs
          .map(doc => ({
            wish: doc.data().wish,
            gratitude: doc.data().gratitude, 
            createdAt: doc.data().createdAt?.toDate()
          }))
          .filter(entry => entry.createdAt) // Filter out entries without dates
          .sort((a, b) => b.createdAt - a.createdAt) // Sort by date desc  
          .slice(0, 10); // Take most recent 10
        
        // Calculate stats
        const stats = {
          totalJournalEntries: journalEntries.length,
          totalManifestEntries: manifestEntries.length,
          totalWords: journalEntries.reduce((sum, entry) => sum + (entry.content?.split(' ').length || 0), 0),
          daysActive: Math.min(7, journalEntries.length) // Simple approximation for weekly
        };
        
        console.log(`[${requestId}] Generating AI insights for ${userName}...`);
        
        // Generate AI insights using actual content analysis
        const insights = await generateInsightsWithOpenAI(
          journalEntries, 
          manifestEntries, 
          stats, 
          'weekly', 
          userName, 
          requestId
        );

        // Send email using existing function
        await sendInsightsEmail(userData.email, insights, 'weekly', userName);
        
        processedUsers.push({
          userId,
          email: userData.email,
          stats: {
            totalJournalEntries: stats.totalJournalEntries,
            totalManifestEntries: stats.totalManifestEntries,
            totalWords: stats.totalWords,
            daysActive: stats.daysActive
          }
        });
        
        console.log(`[${requestId}] ✅ SUCCESS for ${userId}`);
        
      } catch (userError) {
        console.error(`[${requestId}] ❌ Error for user ${userId}:`, userError);
        errors.push({
          userId,
          email: userData.email,
          error: userError.message
        });
      }
    }
    
    console.log(`[${requestId}] 👻 Ghost-free processing complete`);
    return {
      success: true,
      processedUsers,
      errors,
      totalEligible: usersSnapshot.size
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Ghost-free function failed:`, error);
    throw error;
  }
}

// Manual trigger for testing weekly insights (hidden button in production)
exports.triggerWeeklyInsightsTest = onRequest({ 
  secrets: [OPENAI_API_KEY, SENDGRID_API_KEY] 
}, async (req, res) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] 🧪 Manual weekly insights test triggered`);
  
  // Apply CORS
  if (!setupHardenedCORS(req, res)) {
    console.warn(`[${requestId}] Rejected request from unauthorized origin: ${req.headers.origin}`);
    return res.status(403).send('Forbidden');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return sendSecureErrorResponse(res, 405, 'Method not allowed');
  }

  try {
    // Verify authentication for test function
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(`[${requestId}] Missing authorization for test trigger`);
      return sendSecureErrorResponse(res, 401, 'Authentication required');
    }
    
    try {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log(`[${requestId}] Test triggered by authenticated user: ${decodedToken.uid}`);
    } catch (authError) {
      console.error(`[${requestId}] Authentication failed for test:`, authError.message);
      return sendSecureErrorResponse(res, 401, 'Invalid authentication token');
    }

    // GHOST-FREE: Run completely new weekly insights logic
    const result = await ghostFreeWeeklyInsights(requestId);
    
    console.log(`[${requestId}] ✅ Manual weekly insights test completed`);
    res.status(200).json({
      success: true,
      message: 'Weekly insights test completed successfully',
      result
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Weekly insights test failed:`, error);
    res.status(500).json({
      success: false,
      message: 'Weekly insights test failed',
      error: error.message
    });
  }
});

// ===== MONTHLY INSIGHTS FUNCTIONS =====

// Monthly Insights Scheduler - First day of every month at 9AM Hawaii time
exports.monthlyInsightsScheduler = onSchedule({
  schedule: "0 19 1 * *", // First day of every month at 19:00 UTC (9:00 AM Hawaii time UTC-10)
  timeZone: "Pacific/Honolulu", // Hawaii timezone
  secrets: [OPENAI_API_KEY, SENDGRID_API_KEY]
}, async (event) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] 📅 Monthly insights scheduled function triggered`);
  
  try {
    const result = await ghostFreeMonthlyInsights(requestId);
    console.log(`[${requestId}] ✅ Scheduled monthly insights completed:`, result);
    return result;
  } catch (error) {
    console.error(`[${requestId}] ❌ Scheduled monthly insights failed:`, error);
    throw error;
  }
});

// GHOST-FREE MONTHLY INSIGHTS - Based on weekly version but for monthly timeframe
async function ghostFreeMonthlyInsights(requestId) {
  console.log(`[${requestId}] 👻 Starting GHOST-FREE monthly insights`);
  
  try {
    // Get users with monthly insights enabled - simple query
    const usersRef = admin.firestore().collection('users');
    const usersSnapshot = await usersRef.get();
    
    console.log(`[${requestId}] Found ${usersSnapshot.size} total users`);
    
    const processedUsers = [];
    const errors = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Check if monthly insights enabled
      if (!userData.insightsPreferences?.monthlyEnabled) {
        console.log(`[${requestId}] Skipping ${userId} - monthly insights not enabled`);
        continue;
      }
      
      try {
        console.log(`[${requestId}] Processing user ${userId} (${userData.email})`);
        
        // Get recent journal entries - ULTRA SIMPLE approach (no orderBy to avoid index issues)
        const journalRef = admin.firestore().collection('journalEntries');
        const journalDocs = await journalRef
          .where('userId', '==', userId)
          .limit(100) // Get more entries for monthly analysis, then sort manually
          .get();
        
        console.log(`[${requestId}] Found ${journalDocs.size} journal entries for ${userId}`);
        
        // Skip if no activity
        if (journalDocs.size === 0) {
          console.log(`[${requestId}] Skipping ${userId} - no journal entries`);
          continue;
        }
        
        // Get manifest entries too for complete insights - ULTRA SIMPLE approach
        const manifestRef = admin.firestore().collection('manifests');
        const manifestDocs = await manifestRef
          .where('userId', '==', userId)
          .limit(50) // Get more then sort manually  
          .get();
          
        console.log(`[${requestId}] Found ${manifestDocs.size} manifest entries for ${userId}`);
        
        // Prepare data for OpenAI analysis
        const entryCount = journalDocs.size;
        const userName = userData.displayName || userData.signupUsername || 'Friend';
        
        // Convert Firestore documents to arrays and sort manually by date (most recent first)
        // For monthly, we want last 30 days of data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const journalEntries = journalDocs.docs
          .map(doc => ({
            content: doc.data().text, // Journal content is stored in 'text' field
            createdAt: doc.data().createdAt?.toDate()
          }))
          .filter(entry => {
            // Filter for last 30 days AND non-empty content  
            const hasDate = entry.createdAt && entry.createdAt >= thirtyDaysAgo;
            const hasContent = entry.content && entry.content.trim().length >= 3; // At least 3 characters
            
            return hasDate && hasContent;
          })
          .sort((a, b) => b.createdAt - a.createdAt) // Sort by date desc
          .slice(0, 30); // Take most recent 30
        
        // Skip if no meaningful content in the last 30 days
        console.log(`[${requestId}] After filtering: ${journalEntries.length} entries with content for ${userId}`);
        if (journalEntries.length === 0) {
          console.log(`[${requestId}] Skipping ${userId} - no journal entries with content in last 30 days`);
          continue;
        }
        
        const manifestEntries = manifestDocs.docs
          .map(doc => ({
            wish: doc.data().wish,
            gratitude: doc.data().gratitude, 
            createdAt: doc.data().createdAt?.toDate()
          }))
          .filter(entry => entry.createdAt && entry.createdAt >= thirtyDaysAgo) // Filter last 30 days
          .sort((a, b) => b.createdAt - a.createdAt) // Sort by date desc  
          .slice(0, 15); // Take most recent 15
        
        // Calculate stats for monthly - properly count unique active days
        const uniqueDays = new Set();
        journalEntries.forEach(entry => {
          if (entry.createdAt) {
            const dateString = entry.createdAt.toDateString();
            uniqueDays.add(dateString);
          }
        });
        
        const stats = {
          totalJournalEntries: journalEntries.length,
          totalManifestEntries: manifestEntries.length,
          totalWords: journalEntries.reduce((sum, entry) => sum + (entry.content?.split(' ').length || 0), 0),
          daysActive: uniqueDays.size // Actual count of unique days with entries
        };
        
        console.log(`[${requestId}] Generating AI insights for ${userName} (MONTHLY)...`);
        
        // Generate AI insights using actual content analysis - MONTHLY period
        const insights = await generateInsightsWithOpenAI(
          journalEntries, 
          manifestEntries, 
          stats, 
          'monthly', // MONTHLY period instead of weekly
          userName, 
          requestId
        );

        // Send email using monthly email function
        await sendMonthlyInsightsEmail(userData.email, insights, 'monthly', userName);
        
        processedUsers.push({
          userId,
          email: userData.email,
          stats: {
            totalJournalEntries: stats.totalJournalEntries,
            totalManifestEntries: stats.totalManifestEntries,
            totalWords: stats.totalWords,
            daysActive: stats.daysActive
          }
        });
        
        console.log(`[${requestId}] ✅ SUCCESS for ${userId} (MONTHLY)`);
        
      } catch (userError) {
        console.error(`[${requestId}] ❌ Error for user ${userId}:`, userError);
        errors.push({
          userId,
          email: userData.email,
          error: userError.message
        });
      }
    }
    
    console.log(`[${requestId}] 👻 Ghost-free monthly processing complete`);
    return {
      success: true,
      processedUsers,
      errors,
      totalEligible: usersSnapshot.size
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Ghost-free monthly function failed:`, error);
    throw error;
  }
}

// Monthly Insights Test Function
exports.triggerMonthlyInsightsTest = onRequest({ 
  secrets: [OPENAI_API_KEY, SENDGRID_API_KEY] 
}, async (req, res) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] 🧪 Manual monthly insights test triggered`);
  
  // Apply CORS
  if (!setupHardenedCORS(req, res)) {
    return;
  }
  
  // Add test logic here if needed
  res.json({ success: true, message: 'Test function executed' });
});

// === MailChimp Integration ===
exports.addToMailchimp = onCall({ 
  secrets: [MAILCHIMP_API_KEY, MAILCHIMP_LIST_ID] 
}, async (request) => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] 📧 Adding email to MailChimp`);
  
  const { email } = request.data;
  if (!email) {
    console.error(`[${requestId}] ❌ Email is required`);
    throw new HttpsError('invalid-argument', 'Email is required');
  }

  try {
    const apiKey = MAILCHIMP_API_KEY.value();
    const listId = MAILCHIMP_LIST_ID.value();
    const serverPrefix = apiKey.split('-')[1];
    
    const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members`;
    const body = {
      email_address: email,
      status: 'subscribed',
      tags: ['InkWell Web']
    };

    console.log(`[${requestId}] 🔄 Calling MailChimp API for ${email}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `apikey ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`[${requestId}] ❌ MailChimp API error:`, error);
      throw new HttpsError('internal', error.detail || 'MailChimp error');
    }

    const result = await response.json();
    console.log(`[${requestId}] ✅ Successfully added ${email} to MailChimp with tag 'InkWell Web'`);
    
    return { 
      success: true,
      message: 'Email added to MailChimp successfully',
      email: email,
      tags: ['InkWell Web']
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ MailChimp integration failed:`, error);
    throw new HttpsError('internal', `Failed to add email to MailChimp: ${error.message}`);
  }
});

// User Data Migration Function - Migrate existing users to new format
exports.migrateUserData = onCall(async (data, context) => {
  // Only allow admin users to run this function
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  
  // Check if user is an admin
  const uid = context.auth.uid;
  try {
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    if (!userDoc.exists || userDoc.data().userRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admin users can run migration.");
    }
  } catch (error) {
    console.error("Error checking admin status:", error);
    throw new HttpsError("permission-denied", "Unable to verify admin status.");
  }
  
  try {
    console.log("🔄 Starting user data migration...");
    
    const usersRef = admin.firestore().collection("users");
    const snapshot = await usersRef.get();
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    const batch = admin.firestore().batch();
    
    for (const doc of snapshot.docs) {
      try {
        const userData = doc.data();
        const userId = doc.id;
        
        // Check if user needs migration (missing new fields)
        const needsMigration = 
          !userData.userId || 
          !userData.createdAt || 
          userData.special_code === undefined ||
          !userData.insightsPreferences;
        
        if (!needsMigration) {
          skipped++;
          continue;
        }
        
        console.log(`📝 Migrating user: ${userId} (${userData.email || 'no email'})`);
        
        // Prepare updated data while preserving existing values
        const updatedData = {
          // Preserve all existing data
          ...userData,
          
          // Add missing standard fields (only if not already present)
          userId: userData.userId || userId,
          email: userData.email || "", // Preserve existing email or set empty if missing
          displayName: userData.displayName || userData.signupUsername || (userData.email ? userData.email.split('@')[0] : ""),
          signupUsername: userData.signupUsername || userData.displayName || (userData.email ? userData.email.split('@')[0] : ""),
          userRole: userData.userRole || "journaler", // Preserve existing role
          avatar: userData.avatar || "",
          
          // Set special_code to beta for users who don't have it, preserve existing values
          special_code: userData.special_code !== undefined ? userData.special_code : "beta",
          
          // Add missing timestamps
          createdAt: userData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          
          // Add insights preferences if missing
          insightsPreferences: userData.insightsPreferences || {
            weeklyEnabled: true,
            monthlyEnabled: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          }
        };
        
        batch.update(doc.ref, updatedData);
        migrated++;
        
        // Commit batch every 400 operations (Firestore limit is 500)
        if (migrated % 400 === 0) {
          await batch.commit();
          console.log(`💾 Committed batch of ${migrated} migrations`);
        }
        
      } catch (error) {
        console.error(`❌ Error migrating user ${doc.id}:`, error);
        errors++;
      }
    }
    
    // Commit any remaining operations
    if (migrated % 400 !== 0) {
      await batch.commit();
    }
    
    const result = {
      totalUsers: snapshot.size,
      migrated: migrated,
      skipped: skipped,
      errors: errors,
      success: true
    };
    
    console.log("✅ Migration completed:", result);
    return result;
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw new HttpsError("internal", "Migration failed: " + error.message);
  }
});
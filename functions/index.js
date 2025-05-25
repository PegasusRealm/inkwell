const { defineSecret } = require("firebase-functions/params"); 
const { getApps } = require("firebase-admin/app");
const { onCall, onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
if (!getApps().length) {
  admin.initializeApp();
}
const fetch = require("node-fetch");
const cors = require("cors");
const corsHandler = cors({ origin: true });

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

exports.generatePrompt = onRequest({ secrets: [OPENAI_API_KEY] }, (req, res) => {
  corsHandler(req, res, async () => {
    const { topic } = req.body;
    console.log("Received prompt request for topic:", topic);

    const promptContent = topic
      ? `Give me a journaling prompt about: ${topic}`
      : "Give me a creative journaling prompt to help reflect on today.";

    try {
console.log("OPENAI_API_KEY exists:", !!OPENAI_API_KEY.value());      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: promptContent }],
          max_tokens: 60,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", errorText);
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.status(200).json({ prompt: data.choices[0].message.content.trim() });
    } catch (error) {
      console.error("Prompt generation failed:", error.message);
      res.status(500).json({ error: "Prompt generation failed" });
    }
  });
});

exports.askSophy = onRequest({ secrets: [OPENAI_API_KEY] }, (req, res) => {
  corsHandler(req, res, async () => {
    const { entry } = req.body;
    console.log("Received reflection request for entry:", entry);

const systemPrompt = `You are Sophy, a supportive journaling assistant informed by Gestalt Therapy, Positive Psychology, SAMHSA’s Eight Dimensions of Wellness, Kukulu Kumuhana, and Atomic Habits. Respond with warmth and empathy. Keep your reflections brief, focused, and emotionally clear — no more than 2–3 ideas at once. Break thoughts into short, readable paragraphs. Avoid overwhelming the user. If helpful, suggest small, practical actions that build momentum over time.`;
    try {
      console.log("OPENAI_API_KEY exists:", !!OPENAI_API_KEY.value());
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: entry }
          ],
          max_tokens: 500,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", errorText);
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.status(200).json({ insight: data.choices[0].message.content.trim() });
    } catch (error) {
      console.error("Reflection generation failed:", error.message);
      res.status(500).json({ insight: "Sophy couldn't reflect right now." });
    }
  });
});
// Save manifest statement for authenticated user
exports.saveManifest = onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { statement } = data;
  if (!statement || typeof statement !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Manifest statement must be a non-empty string.");
  }

  try {
    await admin.firestore().collection("manifests").doc(uid).set({
      statement,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving manifest:", error);
    throw new functions.https.HttpsError("internal", "Failed to save manifest.");
  }
});

// Load manifest statement for authenticated user
exports.loadManifest = onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  try {
    const doc = await admin.firestore().collection("manifests").doc(uid).get();
    if (!doc.exists) {
      return { statement: "" };
    }
    return { statement: doc.data().statement || "" };
  } catch (error) {
    console.error("Error loading manifest:", error);
    throw new functions.https.HttpsError("internal", "Failed to load manifest.");
  }
});

// Ask Sophy to refine manifest statement
exports.refineManifest = onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { statement } = data;
  if (!statement || typeof statement !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Manifest statement must be a non-empty string.");
  }

  const prompt = `Please help refine this personal manifest statement to make it meaningful, clear, and inspiring:\n"${statement}"`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a journaling assistant that helps users articulate their vision and purpose in a supportive, emotionally aware tone." },
          { role: "user", content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return { refined: data.choices[0].message.content.trim() };
  } catch (error) {
    console.error("Manifest refinement failed:", error.message);
    throw new functions.https.HttpsError("internal", "Failed to refine manifest.");
  }
});

exports.embedAndStoreEntry = onRequest({ secrets: [OPENAI_API_KEY] }, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

      const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY.value()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: text,
          model: "text-embedding-3-small"
        })
      });

      const result = await embeddingResponse.json();
      if (!result?.data?.[0]?.embedding) {
        throw new Error("Failed to retrieve valid embedding from OpenAI.");
      }

      const embedding = result.data[0].embedding;
      await admin.firestore().collection("entries").doc(entryId).set({
        userId: uid,
        text,
        embedding,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      res.status(200).json({ embedding });
    } catch (error) {
      console.error("Embedding error:", error.message);
      res.status(500).json({ error: "Failed to embed and store entry." });
    }
  });
});
// Log search query function
exports.logSearchQuery = onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { query } = data;
  if (!query || typeof query !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Query must be a non-empty string.");
  }

  try {
    await admin.firestore().collection("searchLogs").add({
      userId: uid,
      query,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error("Error logging search query:", error);
    throw new functions.https.HttpsError("internal", "Failed to log search query.");
  }
});

exports.saveCoachReply = onCall(async (data, context) => {
  const coachUid = context.auth?.uid;
  if (!coachUid) {
    throw new functions.https.HttpsError("unauthenticated", "Coach must be authenticated.");
  }

  const { entryId, replyText } = data;
  if (!entryId || !replyText || typeof replyText !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Entry ID and reply text are required.");
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

    return { success: true };
  } catch (error) {
    console.error("Error saving coach reply:", error);
    throw new functions.https.HttpsError("internal", "Failed to save coach reply.");
  }
});


exports.notifyCoachOfTaggedEntry = onRequest({ secrets: [SENDGRID_API_KEY] }, (req, res) => {
  corsHandler(req, res, async () => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());
    console.log("✅ SENDGRID_API_KEY loaded:", !!SENDGRID_API_KEY.value());

    const { entryId } = req.body;
    console.log("🧪 Raw entryId from body:", entryId);

    if (!entryId) {
      console.error("❌ Missing entryId in request body.");
      return res.status(400).send("Missing entry ID.");
    }

    try {
      const entryDoc = await admin.firestore().collection("journalEntries").doc(entryId).get();
      if (!entryDoc.exists) {
        console.error("❌ Entry not found in Firestore for ID:", entryId);
        return res.status(404).send("Entry not found.");
      }

      const entry = entryDoc.data();
      const dateStr = entry.createdAt?.toDate?.().toLocaleString?.() || "Unknown date";
      const manifest = entry.contextManifest || "";
      const entryText = entry.text?.substring(0, 1000) || "(No content)";

      const coachEmail = "coach@inkwelljournal.io";
      const msg = {
        to: coachEmail,
        from: "no-reply@inkwelljournal.io",
        subject: "New Journal Entry Tagged for Coach Review",
        text: `New journal entry tagged:\n\n${entryText}`,
        html: `
          <p><strong>Hi Coach,</strong></p>
          <p>A new entry has been tagged for your review on <strong>${dateStr}</strong>.</p>
          ${manifest ? `<p><strong>Manifest:</strong> ${manifest}</p>` : ""}
          <p><strong>Journal Entry Preview:</strong></p>
          <blockquote style="background:#f9f9f9;padding:1em;border-left:4px solid #FFA76D;">
            ${entryText.replace(/\n/g, "<br/>")}
          </blockquote>
          <p><a href="https://inkwelljournal.io/coach/reply?entryId=${entryId}">Click here to reply</a></p>
          <hr/>
          <p style="font-size:0.9em;color:#777;">
            InkWell by Pegasus Realm • <a href="mailto:support@inkwelljournal.io">support@inkwelljournal.io</a>
          </p>
        `,
      };

      await sgMail.send(msg);
      console.log("✅ SendGrid email sent to:", coachEmail);
      return res.status(200).send("Coach notified.");
    } catch (err) {
      console.error("❌ Email sending failed:", err.response?.body || err.message);
      return res.status(500).send("Failed to notify coach.");
    }
  });
});
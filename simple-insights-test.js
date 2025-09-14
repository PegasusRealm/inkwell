// SIMPLE TEST FOR SOPHY INSIGHTS
// Paste this in the browser console when logged into InkWell

async function simpleInsightsTest() {
  console.log("🧪 Simple Insights Test Starting...");
  
  if (!window.auth?.currentUser) {
    console.log("❌ Please log in first!");
    return;
  }
  
  const userId = window.auth.currentUser.uid;
  const userEmail = window.auth.currentUser.email;
  
  console.log(`✅ User authenticated: ${userEmail}`);
  console.log(`✅ User ID: ${userId}`);
  
  // Test the production insights functions directly
  console.log("🔧 Testing production insights functions...");
  
  // Test weekly insights function
  try {
    console.log("📅 Testing weekly insights...");
    const weeklyResponse = await fetch('https://sendweeklyinsights-qdkxh2u2lq-uc.a.run.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    if (weeklyResponse.ok) {
      const result = await weeklyResponse.json();
      console.log("✅ Weekly insights function works:", result);
    } else {
      console.log("⚠️ Weekly insights status:", weeklyResponse.status);
    }
  } catch (error) {
    console.log("❌ Weekly insights error:", error.message);
  }
  
  // Test monthly insights function
  try {
    console.log("📈 Testing monthly insights...");
    const monthlyResponse = await fetch('https://sendmonthlyinsights-qdkxh2u2lq-uc.a.run.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    if (monthlyResponse.ok) {
      const result = await monthlyResponse.json();
      console.log("✅ Monthly insights function works:", result);
    } else {
      console.log("⚠️ Monthly insights status:", monthlyResponse.status);
    }
  } catch (error) {
    console.log("❌ Monthly insights error:", error.message);
  }
  
  console.log("✅ Simple test complete! If functions work, check your email for insights from sophy@inkwelljournal.io");
}

// Run the test
console.log("🚀 Simple Insights Test Available:");
console.log("Run: simpleInsightsTest()");

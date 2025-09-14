// 🧪 Sophy Insights Troubleshooting & Test Console
// Run this in the browser console after logging in to InkWell

// ===== SAFE SINGLE-USER TEST FUNCTIONS =====

async function testMyWeeklyInsights() {
  console.log("📧 Testing Weekly Insights for current user...");
  
  if (!window.auth?.currentUser) {
    console.error("❌ Please log in first!");
    return;
  }
  
  try {
    const testFunction = window.httpsCallable(window.functions, 'testUserInsights');
    const result = await testFunction({ type: 'weekly' });
    
    console.log("✅ Weekly Insights Test Result:", result.data);
    
    if (result.data.success) {
      const weeklyResult = result.data.results.find(r => r.type === 'weekly');
      if (weeklyResult?.status === 'success') {
        console.log(`📧 Weekly insights email sent to: ${result.data.userEmail}`);
        console.log(`📊 Data analyzed: ${weeklyResult.stats.journalEntries} journal entries, ${weeklyResult.stats.manifestEntries} manifest entries, ${weeklyResult.stats.totalWords} words`);
      } else if (weeklyResult?.status === 'skipped') {
        console.log(`⚠️ ${weeklyResult.message}`);
      } else {
        console.log(`❌ Weekly insights failed: ${weeklyResult?.message}`);
      }
    }
    
  } catch (error) {
    console.error("❌ Weekly insights test failed:", error.message);
  }
}

async function testMyMonthlyInsights() {
  console.log("📧 Testing Monthly Insights for current user...");
  
  if (!window.auth?.currentUser) {
    console.error("❌ Please log in first!");
    return;
  }
  
  try {
    const testFunction = window.httpsCallable(window.functions, 'testUserInsights');
    const result = await testFunction({ type: 'monthly' });
    
    console.log("✅ Monthly Insights Test Result:", result.data);
    
    if (result.data.success) {
      const monthlyResult = result.data.results.find(r => r.type === 'monthly');
      if (monthlyResult?.status === 'success') {
        console.log(`📧 Monthly insights email sent to: ${result.data.userEmail}`);
        console.log(`📊 Data analyzed: ${monthlyResult.stats.journalEntries} journal entries, ${monthlyResult.stats.manifestEntries} manifest entries, ${monthlyResult.stats.totalWords} words`);
      } else if (monthlyResult?.status === 'skipped') {
        console.log(`⚠️ ${monthlyResult.message}`);
      } else {
        console.log(`❌ Monthly insights failed: ${monthlyResult?.message}`);
      }
    }
    
  } catch (error) {
    console.error("❌ Monthly insights test failed:", error.message);
  }
}

async function testBothInsights() {
  console.log("📧 Testing BOTH Weekly & Monthly Insights for current user...");
  
  if (!window.auth?.currentUser) {
    console.error("❌ Please log in first!");
    return;
  }
  
  try {
    const testFunction = window.httpsCallable(window.functions, 'testUserInsights');
    const result = await testFunction({ type: 'both' });
    
    console.log("✅ Full Insights Test Result:", result.data);
    
    if (result.data.success) {
      console.log(`🎯 Tests completed for: ${result.data.userEmail}`);
      console.log("📊 Results Summary:");
      
      result.data.results.forEach(test => {
        if (test.status === 'success') {
          console.log(`  ✅ ${test.type}: Email sent! (${test.stats.journalEntries + test.stats.manifestEntries} entries, ${test.stats.totalWords} words)`);
        } else if (test.status === 'skipped') {
          console.log(`  ⚠️ ${test.type}: ${test.message}`);
        } else {
          console.log(`  ❌ ${test.type}: ${test.message}`);
        }
      });
      
      const successCount = result.data.results.filter(r => r.status === 'success').length;
      if (successCount > 0) {
        console.log(`\n🎉 Check your email! ${successCount} insight email(s) sent.`);
      }
    }
    
  } catch (error) {
    console.error("❌ Insights test failed:", error.message);
  }
}

// ===== SETTINGS TEST FUNCTIONS =====

async function testInsightsSettings() {
  console.log("⚙️ Testing Sophy Insights Settings...");
  
  const weeklyCheckbox = document.getElementById("weeklyInsightsEnabled");
  const monthlyCheckbox = document.getElementById("monthlyInsightsEnabled");
  
  if (weeklyCheckbox && monthlyCheckbox) {
    console.log("✅ Settings UI elements found");
    console.log("  Weekly enabled:", weeklyCheckbox.checked);
    console.log("  Monthly enabled:", monthlyCheckbox.checked);
    
    // Test enabling both
    weeklyCheckbox.checked = true;
    monthlyCheckbox.checked = true;
    console.log("🔄 Enabled both insights for testing...");
    
    try {
      await window.saveUserSettings();
      console.log("✅ Settings saved to Firestore");
      
      // Verify persistence
      setTimeout(async () => {
        await window.loadCurrentUserSettings();
        const weeklyAfter = document.getElementById("weeklyInsightsEnabled").checked;
        const monthlyAfter = document.getElementById("monthlyInsightsEnabled").checked;
        console.log("✅ Settings persistence verified:");
        console.log("  Weekly enabled after reload:", weeklyAfter);
        console.log("  Monthly enabled after reload:", monthlyAfter);
      }, 1500);
      
    } catch (error) {
      console.error("❌ Error saving settings:", error);
    }
  } else {
    console.log("❌ Settings UI elements not found - open User Settings first!");
  }
}

async function checkMyDataAvailability() {
  console.log("📊 Checking available data for insights...");
  
  if (!window.auth?.currentUser || !window.db) {
    console.error("❌ Please log in first!");
    return;
  }
  
  const userId = window.auth.currentUser.uid;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const monthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  try {
    // Check journal entries
    const weeklyJournals = await window.getDocs(
      window.query(
        window.collection(window.db, "journals"),
        window.where("userId", "==", userId),
        window.where("createdAt", ">=", weekAgo)
      )
    );
    
    const monthlyJournals = await window.getDocs(
      window.query(
        window.collection(window.db, "journals"),
        window.where("userId", "==", userId),
        window.where("createdAt", ">=", monthAgo)
      )
    );
    
    // Check manifest entries
    const weeklyManifests = await window.getDocs(
      window.query(
        window.collection(window.db, "manifests"),
        window.where("userId", "==", userId),
        window.where("createdAt", ">=", weekAgo)
      )
    );
    
    const monthlyManifests = await window.getDocs(
      window.query(
        window.collection(window.db, "manifests"),
        window.where("userId", "==", userId),
        window.where("createdAt", ">=", monthAgo)
      )
    );
    
    console.log("📈 Data Available for Analysis:");
    console.log(`  📝 Past 7 days: ${weeklyJournals.size} journal entries, ${weeklyManifests.size} manifest entries`);
    console.log(`  📝 Past 30 days: ${monthlyJournals.size} journal entries, ${monthlyManifests.size} manifest entries`);
    
    if (weeklyJournals.size + weeklyManifests.size === 0) {
      console.log("⚠️ No recent entries found - create some journal/manifest entries to test insights!");
    } else {
      console.log("✅ You have data available for insights testing!");
    }
    
  } catch (error) {
    console.error("❌ Error checking data:", error);
  }
}

// ===== HELP & INSTRUCTIONS =====

function showInsightsHelp() {
  console.log(`
🌟 SOPHY INSIGHTS TESTING CONSOLE
=================================

🧪 SAFE TEST FUNCTIONS (Only affects YOUR account):
• testMyWeeklyInsights()    - Generate & send weekly insights email  
• testMyMonthlyInsights()   - Generate & send monthly insights email
• testBothInsights()        - Generate & send BOTH weekly & monthly emails

⚙️ SETTINGS TEST FUNCTIONS:
• testInsightsSettings()    - Test settings UI save/load
• checkMyDataAvailability() - Check if you have entries for analysis

📊 TROUBLESHOOTING STEPS:
1. Make sure you're logged in
2. Run checkMyDataAvailability() to see your data
3. Run testInsightsSettings() to verify settings work
4. Run testBothInsights() to generate test emails
5. Check your email inbox!

💡 TIPS:
• Create some journal/manifest entries first for better insights
• The AI analyzes your actual entries for personalized content
• Emails come from sophy@inkwelljournal.io
• Functions are safe - only process YOUR data
  `);
}

// Auto-show help on load
console.log("🌟 Sophy Insights Testing Console Loaded!");
console.log("Run showInsightsHelp() for instructions, or testBothInsights() to try it now!");

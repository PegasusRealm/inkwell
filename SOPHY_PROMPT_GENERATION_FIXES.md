# Sophy Prompt Generation Fixes

## Issues Identified
1. **Character Limit Too Low**: Prompts were being cut off mid-sentence due to `max_tokens: 60` setting
2. **Quotation Marks**: Prompts were appearing with unwanted quotation marks around them

## Root Cause Analysis

### Character Limit Issue
- The `generatePrompt` function was set to `max_tokens: 60`
- 60 tokens ≈ 45-75 words, which is insufficient for complete journaling prompts
- This caused prompts to be truncated mid-sentence, as seen in the user's screenshot

### Quotation Marks Issue
- OpenAI was naturally responding with quotes around prompts
- No system prompt was guiding the formatting
- No post-processing was removing unwanted formatting

## Fixes Implemented

### 1. Increased Token Limit
```javascript
// Before
max_tokens: 60

// After  
max_tokens: 200
```
- 200 tokens allows for 150-300 words
- Sufficient for complete, thoughtful prompts
- Matches the pattern of other functions (askSophy uses 500 tokens)

### 2. Added System Prompt for Clean Formatting
```javascript
const systemPrompt = `You are Sophy, a supportive journaling assistant. Generate thoughtful, engaging journaling prompts. Always respond with just the prompt text directly - never wrap your response in quotation marks or say things like "Here's a prompt:" or similar prefixes. Just provide the actual prompt text.`;
```

### 3. Post-Processing Cleanup
```javascript
// Remove surrounding quotes if they exist
if ((cleanPrompt.startsWith('"') && cleanPrompt.endsWith('"')) ||
    (cleanPrompt.startsWith("'") && cleanPrompt.endsWith("'"))) {
  cleanPrompt = cleanPrompt.slice(1, -1);
}

// Remove any prefixes like "Here's a prompt:" or similar
cleanPrompt = cleanPrompt.replace(/^(Here's a prompt:|Here's your prompt:|Prompt:|Journal prompt:)\s*/i, '');
```

## Changes Made

### File: `/functions/index.js`
- **Line 245**: Changed `max_tokens` from 60 to 200
- **Added system prompt**: Instructs Sophy to provide clean, unquoted responses
- **Added post-processing**: Removes quotes and unwanted prefixes
- **Updated API call**: Now uses system + user message pattern instead of single user message

## Expected Results

### Before Fix
- Prompts cut off mid-sentence: "What were you 'testing' or exploring during that period? Describe the emotions you experienced as you navigated this uncertainty. How did this process of testing different options help you gain clarity or insight? What"
- Surrounded by quotes: "What is something you..."

### After Fix
- Complete prompts: Full sentences that provide complete journaling guidance
- Clean formatting: No surrounding quotes or unnecessary prefixes
- Natural language: Flows as if Sophy is speaking directly to the user

## Testing
- Functions deployed successfully to production
- All 15 functions updated without errors
- Ready for immediate testing through the "Ask Sophy for a Prompt" button

## Technical Details
- **Function**: `generatePrompt` in `/functions/index.js`
- **Model**: `gpt-4o-mini` (unchanged)
- **Temperature**: 0.7 (unchanged for creativity)
- **Token increase**: 60 → 200 (3.3x increase)
- **New architecture**: System prompt + user prompt for better control

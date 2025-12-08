/**
 * DeepL Translation API Endpoint
 * 
 * Add this endpoint to your server.js file:
 * 
 * POST /api/translate
 * 
 * Body: {
 *   text: string
 *   source_lang: 'EN' | 'FR'
 *   target_lang: 'EN' | 'FR'
 * }
 * 
 * Returns: {
 *   translatedText: string
 * }
 * 
 * Example implementation:
 */

// In server.js, add this route:
/*
app.post('/api/translate', async (req, res) => {
  try {
    const { text, source_lang, target_lang } = req.body
    
    if (!text || !source_lang || !target_lang) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    
    // Skip translation if source and target are the same
    if (source_lang === target_lang) {
      return res.json({ translatedText: text })
    }
    
    // Get DeepL API key from environment
    const deeplApiKey = process.env.DEEPL_API_KEY
    if (!deeplApiKey) {
      return res.status(500).json({ error: 'DeepL API key not configured' })
    }
    
    // Auto-detect API endpoint based on key format (Free keys end with ':fx')
    const isFreeKey = deeplApiKey.endsWith(':fx')
    const defaultUrl = isFreeKey 
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate'
    const deeplUrl = process.env.DEEPL_API_URL || defaultUrl
    
    const response = await fetch(deeplUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: text,
        source_lang: source_lang,
        target_lang: target_lang,
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('DeepL API error:', errorText)
      return res.status(response.status).json({ error: 'Translation failed' })
    }
    
    const data = await response.json()
    const translatedText = data.translations?.[0]?.text || text
    
    res.json({ translatedText })
  } catch (error) {
    console.error('Translation error:', error)
    res.status(500).json({ error: 'Translation service error' })
  }
})
*/

/**
 * Environment Variables Required:
 * 
 * DEEPL_API_KEY=your-deepl-api-key-here
 * DEEPL_API_URL (optional) - Override the auto-detected endpoint
 * 
 * API Endpoint Auto-Detection:
 * The correct endpoint is automatically detected based on your API key:
 * - Free API keys end with ':fx' → uses https://api-free.deepl.com/v2/translate
 * - Pro API keys (no ':fx' suffix) → uses https://api.deepl.com/v2/translate
 * 
 * To get a DeepL API key:
 * 1. Sign up at https://www.deepl.com/pro-api
 * 2. Get your API key from the dashboard
 * 3. Add it to your .env file
 * 
 * Note: Free and Pro API keys are NOT interchangeable!
 * Make sure you're using the correct key for your subscription tier.
 */

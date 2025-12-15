# 🌐 DeepL Translation API Setup

<div align="center">

![DeepL](https://img.shields.io/badge/DeepL-API-0f2b46?style=flat-square&logo=deepl)
![Translation](https://img.shields.io/badge/Auto-Translation-success?style=flat-square)
![Languages](https://img.shields.io/badge/EN%20%E2%86%94%20FR-Supported-blue?style=flat-square)

**Configure automatic plant translations using the DeepL API for seamless multi-language support.**

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Getting an API Key](#-getting-an-api-key)
- [Configuration](#️-configuration)
- [API Endpoint](#-api-endpoint)
- [Usage](#-usage)
- [Error Handling](#-error-handling)
- [Rate Limits](#-rate-limits)

---

## 🎯 Overview

Aphylia uses the DeepL API to automatically translate plant information between supported languages. This enables:

- **Automatic plant translations** when creating/editing plants
- **On-demand translation** for user-generated content
- **Batch translation** for bulk operations

### Supported Languages

| Language | Code | Status |
|----------|------|--------|
| English | `EN` | ✅ Default |
| French | `FR` | ✅ Supported |

---

## 🔑 Getting an API Key

### Step 1: Sign Up

1. Go to [DeepL Pro API](https://www.deepl.com/pro-api)
2. Create an account or sign in
3. Choose a plan:
   - **Free**: 500,000 characters/month
   - **Pro**: Pay-as-you-go, higher limits

### Step 2: Get Your Key

1. Navigate to your [Account Settings](https://www.deepl.com/account/summary)
2. Find "Authentication Key for DeepL API"
3. Copy your API key

### Step 3: Determine API URL

| Plan | API URL |
|------|---------|
| **Free** | `https://api-free.deepl.com/v2/translate` |
| **Pro** | `https://api.deepl.com/v2/translate` |

---

## ⚙️ Configuration

### Environment Variables

Add these to your `plant-swipe/.env.server` file:

```bash
# DeepL API Configuration
DEEPL_API_KEY=your-deepl-api-key-here

# Optional: API URL (defaults to Pro endpoint)
DEEPL_API_URL=https://api.deepl.com/v2/translate

# For Free plan, use:
# DEEPL_API_URL=https://api-free.deepl.com/v2/translate
```

### Verify Configuration

Test your API key works:

```bash
curl -X POST "https://api.deepl.com/v2/translate" \
  -H "Authorization: DeepL-Auth-Key YOUR_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "text=Hello, world!&target_lang=FR"
```

Expected response:

```json
{
  "translations": [
    {
      "detected_source_language": "EN",
      "text": "Bonjour, monde !"
    }
  ]
}
```

---

## 🔌 API Endpoint

### `POST /api/translate`

Translate text between languages.

#### Request

```typescript
POST /api/translate
Content-Type: application/json

{
  "text": "A beautiful flowering plant with fragrant petals",
  "source_lang": "EN",
  "target_lang": "FR"
}
```

#### Response

```typescript
{
  "translatedText": "Une belle plante à fleurs aux pétales parfumés"
}
```

#### Error Response

```typescript
{
  "error": "Translation failed"
}
```

### Server Implementation

The endpoint is implemented in `server.js`:

```javascript
app.post('/api/translate', async (req, res) => {
  try {
    const { text, source_lang, target_lang } = req.body
    
    // Validate required fields
    if (!text || !source_lang || !target_lang) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    
    // Skip if same language
    if (source_lang === target_lang) {
      return res.json({ translatedText: text })
    }
    
    // Check for API key
    const deeplApiKey = process.env.DEEPL_API_KEY
    if (!deeplApiKey) {
      return res.status(500).json({ error: 'DeepL API key not configured' })
    }
    
    // Call DeepL API
    const deeplUrl = process.env.DEEPL_API_URL || 'https://api.deepl.com/v2/translate'
    
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
```

---

## 📖 Usage

### Translate Plant Fields

```typescript
import { translatePlantToAllLanguages } from '@/lib/deepl'

// Translate all translatable fields
const translations = await translatePlantToAllLanguages({
  name: "Rose",
  scientificName: "Rosa",
  meaning: "Love and beauty",
  description: "A flowering plant with thorny stems",
  careSoil: "Well-drained, fertile soil",
  careWater: "Regular watering, keep soil moist",
  careLight: "Full sun to partial shade"
}, 'en')

// Result: translations for each target language
// { fr: { name: "Rose", meaning: "Amour et beauté", ... } }
```

### Translate Single Text

```typescript
import { translateText } from '@/lib/deepl'

const frenchText = await translateText(
  "Beautiful spring flowers",
  "EN",
  "FR"
)
// Result: "Belles fleurs de printemps"
```

### In Plant Forms

The plant create/edit forms automatically:

1. Detect when translation is needed
2. Call the translation API
3. Populate translation fields
4. Allow manual editing before save

---

## ❌ Error Handling

### Common Errors

| Error Code | Meaning | Solution |
|------------|---------|----------|
| 400 | Bad Request | Check request format |
| 403 | Forbidden | Invalid API key |
| 429 | Too Many Requests | Rate limit exceeded, wait |
| 456 | Quota Exceeded | Upgrade plan or wait for reset |
| 500 | Server Error | Try again later |

### Graceful Degradation

When translation fails, the app:

1. Falls back to the source language text
2. Logs the error for debugging
3. Shows a user-friendly message
4. Allows manual translation entry

```typescript
try {
  const translated = await translateText(text, 'EN', 'FR')
  return translated
} catch (error) {
  console.error('Translation failed:', error)
  // Return original text as fallback
  return text
}
```

---

## 📊 Rate Limits

### Free Plan

| Limit | Value |
|-------|-------|
| Characters/month | 500,000 |
| Requests/second | ~5 |

### Pro Plan

| Limit | Value |
|-------|-------|
| Characters/month | Based on usage |
| Requests/second | Higher limits |

### Best Practices

1. **Batch translations** when possible
2. **Cache results** to avoid re-translating
3. **Skip identical languages** (source === target)
4. **Implement retry logic** for transient failures

```typescript
// Example: Batch translation
const textsToTranslate = [name, meaning, description].filter(Boolean)
const translatedBatch = await Promise.all(
  textsToTranslate.map(text => translateText(text, 'EN', 'FR'))
)
```

---

## 🔍 Monitoring

### Check Usage

Monitor your API usage at:
- [DeepL Account Dashboard](https://www.deepl.com/account/usage)

### Logging

The server logs translation requests:

```javascript
console.log(`Translating ${text.length} chars from ${source_lang} to ${target_lang}`)
```

### Metrics to Track

- Characters translated per day
- API response times
- Error rates
- Cache hit rates (if implemented)

---

## 📚 Resources

| Resource | Link |
|----------|------|
| DeepL API Documentation | [developers.deepl.com](https://developers.deepl.com/docs) |
| API Reference | [API Reference](https://developers.deepl.com/docs/api-reference) |
| Pricing | [DeepL Pro](https://www.deepl.com/pro) |
| Supported Languages | [Language Support](https://developers.deepl.com/docs/resources/supported-languages) |

---

<div align="center">

**Translation powered by DeepL** 🌐

[**Technical Documentation**](./README.md) • [**Main README**](../README.md)

</div>

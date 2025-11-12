// Supabase Edge Function to fill plant data using OpenAI
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-5.1'

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://dev01.aphylia.app',
]

const envAllowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const allowList = new Set([...defaultAllowedOrigins, ...envAllowedOrigins])

const baseCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

const disallowedImageKeys = new Set(['image', 'imageurl', 'image_url', 'imageURL', 'thumbnail', 'photo', 'picture'])

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const sanitizeTemplate = (node: JsonValue, path: string[] = []): JsonValue => {
  if (Array.isArray(node)) {
    return node.map((item) => sanitizeTemplate(item, path))
  }
  if (node && typeof node === 'object') {
    const result: Record<string, JsonValue> = {}
    for (const [key, value] of Object.entries(node)) {
      const lowerKey = key.toLowerCase()
      if (disallowedImageKeys.has(lowerKey)) {
        continue
      }
      if (lowerKey === 'name' && path.length === 0) {
        continue
      }
      result[key] = sanitizeTemplate(value, [...path, key])
    }
    return result
  }
  return node
}

const ensureStructure = (template: JsonValue, target: JsonValue): JsonValue => {
  if (Array.isArray(template)) {
    return Array.isArray(target) ? target : []
  }
  if (template && typeof template === 'object') {
    const result: Record<string, JsonValue> =
      target && typeof target === 'object' && !Array.isArray(target) ? { ...target as Record<string, JsonValue> } : {}

    for (const [key, templateValue] of Object.entries(template)) {
      if (!(key in result)) {
        if (Array.isArray(templateValue)) {
          result[key] = []
        } else if (templateValue && typeof templateValue === 'object') {
          result[key] = ensureStructure(templateValue, {})
        } else {
          result[key] = null
        }
      } else if (templateValue && typeof templateValue === 'object') {
        result[key] = ensureStructure(templateValue, result[key])
      }
    }
    return result
  }
  return target ?? null
}

const stripDisallowedKeys = (node: JsonValue, path: string[] = []): JsonValue => {
  if (Array.isArray(node)) {
    return node.map((item) => stripDisallowedKeys(item, path))
  }
  if (node && typeof node === 'object') {
    const result: Record<string, JsonValue> = {}
    for (const [key, value] of Object.entries(node)) {
      const lowerKey = key.toLowerCase()
      if (disallowedImageKeys.has(lowerKey)) {
        continue
      }
      if (lowerKey === 'name' && path.length === 0) {
        continue
      }
      result[key] = stripDisallowedKeys(value, [...path, key])
    }
    return result
  }
  return node
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowOrigin = allowList.has('*')
    ? '*'
    : allowList.has(origin)
      ? origin
      : ''

  if (!allowOrigin) {
    return { ...baseCorsHeaders }
  }

  return {
    ...baseCorsHeaders,
    'Access-Control-Allow-Origin': allowOrigin,
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
      const { plantName, schema } = await req.json()

    if (!plantName) {
      return new Response(
        JSON.stringify({ error: 'Plant name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

      const sanitizedSchema = sanitizeTemplate(schema) as Record<string, JsonValue>

      // Build the prompt
      const prompt = `You are an encyclopedic botanical expert. Fill in the plant information JSON for "${plantName}" using the schema provided.

IMPORTANT INSTRUCTIONS:
1. Return ONLY valid JSON text matching the provided schema structure
2. Do NOT include any markdown formatting, code blocks, or explanations
3. Do NOT include the "id" field
4. Do NOT include the top-level "name" field or any image / imageUrl style fields
5. Every property that exists in the schema (including deeply nested ones) MUST be present in your JSON output. Do not omit keys—use null, empty strings, or empty arrays if you cannot supply real data.
6. Use exact values from the schema options where specified. When options are enumerations, prefer the canonical wording used by horticulture sources.
7. For arrays, provide rich content with at least three well-researched items whenever possible; otherwise fall back to an empty array.
8. For textual descriptions, write thorough multi-sentence explanations. Aim for professional, detailed paragraphs.
9. For nested objects, include every sub-field. If information is unavailable for a sub-field, set it to null instead of skipping it.
10. Ensure every top-level section in the schema (identifiers, traits, dimensions, phenology, environment, care, propagation, usage, ecology, commerce, problems, planting, meta) contains thoughtful, specific content grounded in reputable botanical references.
11. In the meta.funFact field, provide a detailed description of the plant's cultural symbolism, lore, or traditional meaning. If none exists, explicitly state that it is not well documented.
12. Be accurate and scientific—if a fact is uncertain, mark the field as null rather than inventing information.
13. Return ONLY the JSON object, nothing else.

SCHEMA STRUCTURE:
${JSON.stringify(sanitizedSchema, null, 2)}

Fill in as much accurate information as possible for "${plantName}". Return ONLY the JSON object.`

    // Call OpenAI API
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a botanical expert assistant. You provide accurate plant information in JSON format only, with no additional text or formatting.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
            temperature: 0.2,
          response_format: { type: 'json_object' }
        })
      })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to get AI response', details: errorData }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No content in AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

      // Parse the JSON response
      let plantData
    try {
      // Remove any markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      plantData = JSON.parse(cleanedContent)
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content)
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response as JSON', content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

      plantData = ensureStructure(sanitizedSchema, plantData)
      plantData = stripDisallowedKeys(plantData)

      // Ensure meta.funFact is populated to avoid blank meaning fields downstream
      if (!plantData || typeof plantData !== 'object') {
        plantData = {}
      }

      if (!('meta' in plantData) || typeof plantData.meta !== 'object' || plantData.meta === null) {
        plantData.meta = {}
      }

      if (!plantData.meta.funFact) {
        plantData.meta.funFact = `Symbolic meaning information for ${plantName} is currently not well documented; please supplement this entry with future research.`
      }

    return new Response(
      JSON.stringify({ success: true, data: plantData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

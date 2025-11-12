// Supabase Edge Function to fill plant data using OpenAI
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = 'gpt-5-2025-08-07'

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
const metadataKeys = new Set(['type', 'description', 'options', 'items', 'additionalProperties', 'examples', 'format'])

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

const schemaToBlueprint = (node: JsonValue): JsonValue => {
  if (Array.isArray(node)) {
    if (node.length === 0) return []
    return node.map((item) => schemaToBlueprint(item))
  }
  if (!node || typeof node !== 'object') {
    return null
  }
  const obj = node as Record<string, JsonValue>
  if (typeof obj.type === 'string') {
    const typeValue = obj.type.toLowerCase()
    if (typeValue === 'array') {
      const items = obj.items
      if (!items) return []
      const blueprintItem = schemaToBlueprint(items)
      return Array.isArray(blueprintItem) ? blueprintItem : [blueprintItem]
    }
    if (typeValue === 'object') {
      const result: Record<string, JsonValue> = {}
      const source =
        typeof obj.properties === 'object' && obj.properties !== null && !Array.isArray(obj.properties)
          ? (obj.properties as Record<string, JsonValue>)
          : Object.fromEntries(
              Object.entries(obj).filter(([key]) => !metadataKeys.has(key))
            )
      for (const [key, value] of Object.entries(source)) {
        result[key] = schemaToBlueprint(value)
      }
      return result
    }
    return null
  }

  const result: Record<string, JsonValue> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (metadataKeys.has(key)) continue
    result[key] = schemaToBlueprint(value)
  }
  return result
}

const buildJsonSchema = (node: JsonValue): Record<string, JsonValue> => {
  if (Array.isArray(node)) {
    const itemSchema = node.length > 0 ? buildJsonSchema(node[0]) : {}
    return { type: 'array', items: itemSchema }
  }
  if (!node || typeof node !== 'object') {
    return { type: 'string' }
  }

  const obj = node as Record<string, JsonValue>
  if (typeof obj.type === 'string') {
    const typeValue = obj.type.toLowerCase()
    const schema: Record<string, JsonValue> = {
      type: ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'].includes(typeValue)
        ? typeValue
        : 'string'
    }
    if (typeof obj.description === 'string') {
      schema.description = obj.description
    }
    if (Array.isArray(obj.options) && obj.options.length > 0) {
      schema.enum = obj.options
    }
    if (typeValue === 'array') {
      const items = obj.items
      if (typeof items === 'string') {
        schema.items = { type: items }
      } else if (items && typeof items === 'object') {
        schema.items = buildJsonSchema(items)
      } else {
        schema.items = {}
      }
    } else if (typeValue === 'object') {
      const source =
        typeof obj.properties === 'object' && obj.properties !== null && !Array.isArray(obj.properties)
          ? (obj.properties as Record<string, JsonValue>)
          : Object.fromEntries(
              Object.entries(obj).filter(([key]) => !metadataKeys.has(key))
            )
      const properties: Record<string, JsonValue> = {}
      for (const [key, value] of Object.entries(source)) {
        properties[key] = buildJsonSchema(value)
      }
      schema.properties = properties
      if (!('additionalProperties' in schema)) {
        schema.additionalProperties = false
      }
    }

    if ('additionalProperties' in obj) {
      const ap = obj.additionalProperties
      if (typeof ap === 'string') {
        schema.additionalProperties = { type: ap }
      } else if (ap && typeof ap === 'object') {
        schema.additionalProperties = buildJsonSchema(ap)
      } else if (typeof ap === 'boolean') {
        schema.additionalProperties = ap
      }
    }

    return schema
  }

  const properties: Record<string, JsonValue> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (metadataKeys.has(key)) continue
    properties[key] = buildJsonSchema(value)
  }
  return {
    type: 'object',
    properties,
    additionalProperties: false
  }
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

      const sanitizedSchemaRaw = sanitizeTemplate(schema)
      if (!sanitizedSchemaRaw || Array.isArray(sanitizedSchemaRaw) || typeof sanitizedSchemaRaw !== 'object') {
        return new Response(
          JSON.stringify({ error: 'Invalid schema provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const sanitizedSchema = sanitizedSchemaRaw as Record<string, JsonValue>
      const schemaBlueprint = schemaToBlueprint(sanitizedSchema)
      const structuredSchema = buildJsonSchema(sanitizedSchema)

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

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            reasoning: { effort: 'high' },
            input: [
              {
                role: 'developer',
                content: prompt
              },
              {
                role: 'user',
                content: `Provide the complete JSON record for the plant "${plantName}" strictly following the schema above.`
              }
            ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'plant_data',
              strict: true,
              schema: structuredSchema
            }
          }
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
      const contentText =
        typeof data.output_text === 'string'
          ? data.output_text
          : Array.isArray(data.output)
            ? data.output
                .map((segment: Record<string, unknown>) => {
                  const content = Array.isArray(segment.content) ? segment.content : []
                  const firstText = content.find((entry) => entry && entry.type === 'output_text')
                  return firstText?.text ?? ''
                })
                .join('')
            : null

      if (!contentText) {
        return new Response(
          JSON.stringify({ error: 'No content in AI response' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let plantData: JsonValue
      try {
        const cleanedContent = contentText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        plantData = JSON.parse(cleanedContent)
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Content:', contentText)
        return new Response(
          JSON.stringify({ error: 'Failed to parse AI response as JSON', content: contentText }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      plantData = ensureStructure(schemaBlueprint, plantData)
      plantData = stripDisallowedKeys(plantData)

      let plantRecord: JsonValue = plantData
      if (!plantRecord || typeof plantRecord !== 'object' || Array.isArray(plantRecord)) {
        plantRecord = {}
      }

      const plantObject = plantRecord as Record<string, JsonValue>

      if (!('meta' in plantObject) || typeof plantObject.meta !== 'object' || plantObject.meta === null || Array.isArray(plantObject.meta)) {
        plantObject.meta = {}
      }

      const metaObject = plantObject.meta as Record<string, JsonValue>
      if (!metaObject.funFact) {
        metaObject.funFact = `Symbolic meaning information for ${plantName} is currently not well documented; please supplement this entry with future research.`
      }

    return new Response(
        JSON.stringify({ success: true, data: plantObject }),
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

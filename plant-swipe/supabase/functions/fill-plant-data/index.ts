// Supabase Edge Function to fill plant data using OpenAI
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-5'

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

      // Build the prompt
      const prompt = `You are a botanical expert. Fill in the plant information JSON for the plant named "${plantName}".

IMPORTANT INSTRUCTIONS:
1. Return ONLY valid JSON text matching the provided schema structure
2. Do NOT include any markdown formatting, code blocks, or explanations
3. Do NOT include the "id" field
4. Do NOT include the "name" field
5. Leave fields blank/null if information is unavailable, uncertain, or not applicable
6. Use exact values from the schema options where specified
7. For arrays, use empty arrays [] if no data is available
8. For nested objects, omit them entirely if all fields would be empty, otherwise include every known sub-field
9. Ensure every top-level section in the schema (identifiers, traits, dimensions, phenology, environment, care, propagation, usage, ecology, commerce, problems, planting, meta) is evaluated and filled with best-available information
10. In the meta.funFact field, provide a short description of the plant's cultural symbolism, traditional meaning, or notable lore; if no symbolism exists, state that explicitly instead of leaving it empty
11. Be accurate and scientific - if you're not certain about a fact, omit it rather than guessing
12. Return ONLY the JSON object, nothing else

SCHEMA STRUCTURE:
${JSON.stringify(schema, null, 2)}

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
          temperature: 0.3, // Lower temperature for more consistent, factual responses
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

      // Remove id and name fields if present
      delete plantData.id
      delete plantData.name

      // Ensure meta.funFact is populated to avoid blank meaning fields downstream
      if (!plantData.meta) {
        plantData.meta = {}
      }
      if (typeof plantData.meta === 'object' && !plantData.meta.funFact) {
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

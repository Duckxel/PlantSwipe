# Fill Plant Data - Supabase Edge Function

This Edge Function uses OpenAI's GPT-4o model to automatically fill plant information based on the plant name.

## Setup

1. **Set OpenAI API Key in Supabase:**
   ```bash
   supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
   ```

   Or if you prefer to use your local `.env` file:
   ```bash
   # Add to your .env file (server-side only, not exposed to client)
   OPENAI_API_KEY=your-openai-api-key-here
   
   # Then set it in Supabase
   supabase secrets set OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)
   ```

2. **Deploy the function:**
   ```bash
   supabase functions deploy fill-plant-data
   ```

## Usage

The function is called from the CreatePlantPage when the user clicks "Fill with AI" button in Advanced mode.

## API

**Endpoint:** `POST /functions/v1/fill-plant-data`

**Request Body:**
```json
{
  "plantName": "Rose",
  "schema": { ... } // PLANT-INFO-SCHEMA.json structure
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "identifiers": { ... },
    "traits": { ... },
    // ... all other plant fields except id and name
  }
}
```

## Notes

- The function uses GPT-4o (latest model)
- It returns only JSON, no markdown formatting
- Fields can be left blank if information is unavailable
- The function excludes `id` and `name` fields from the response
- The API key is stored securely in Supabase secrets and never exposed to the client

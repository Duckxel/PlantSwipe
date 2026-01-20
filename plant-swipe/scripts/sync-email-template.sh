#!/bin/bash

# Sync Email Template Script
# Copies the shared email template from frontend to Supabase edge functions
# 
# Run this after making changes to src/lib/emailTemplateShared.ts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SOURCE_FILE="$PROJECT_ROOT/src/lib/emailTemplateShared.ts"
DEST_DIR="$PROJECT_ROOT/supabase/functions/_shared"
DEST_FILE="$DEST_DIR/emailTemplateShared.ts"

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

# Copy the file
cp "$SOURCE_FILE" "$DEST_FILE"

echo "✅ Synced email template to Supabase functions"
echo "   Source: $SOURCE_FILE"
echo "   Dest:   $DEST_FILE"
echo ""
echo "⚠️  Remember to redeploy the edge function after syncing:"
echo "   supabase functions deploy email-campaign-runner"

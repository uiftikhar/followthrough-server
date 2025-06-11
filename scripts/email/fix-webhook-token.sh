#!/bin/bash

# Gmail Webhook Token Fix Script
# This script helps fix the webhook token validation issue

echo "🔧 Gmail Webhook Token Fix"
echo "=========================="
echo

# Check if .env file exists
if [ -f ".env" ]; then
    echo "📋 Checking your .env file for GMAIL_WEBHOOK_TOKEN..."
    
    # Check for the GMAIL_WEBHOOK_TOKEN
    if grep -q "GMAIL_WEBHOOK_TOKEN" .env; then
        echo "⚠️  Found GMAIL_WEBHOOK_TOKEN in .env file"
        echo "   Google doesn't send custom tokens by default, so this is causing rejections."
        echo
        echo "Options:"
        echo "1. Remove GMAIL_WEBHOOK_TOKEN (recommended for basic setup)"
        echo "2. Keep it (only works if you configure your Pub/Sub subscription to send tokens)"
        echo
        read -p "🔨 Remove GMAIL_WEBHOOK_TOKEN from .env? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Backup the original .env
            cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
            echo "💾 Backed up .env to .env.backup.$(date +%Y%m%d_%H%M%S)"
            
            # Remove the token line
            sed -i.tmp '/GMAIL_WEBHOOK_TOKEN/d' .env && rm .env.tmp
            echo "✅ Removed GMAIL_WEBHOOK_TOKEN from .env"
            echo "   Your webhook will now accept Google's standard push notifications."
        else
            echo "⚠️  Keeping GMAIL_WEBHOOK_TOKEN."
            echo "   Note: Google won't send this token unless you configure it in your Pub/Sub subscription."
            echo "   The webhook has been updated to handle this gracefully."
        fi
    else
        echo "✅ No GMAIL_WEBHOOK_TOKEN found in .env - good!"
        echo "   Your webhook will accept Google's standard push notifications."
    fi
    
    echo
    echo "📋 Current Gmail configuration:"
    echo "-----------------------------"
    grep -E "^(GOOGLE_CLOUD_PROJECT_ID|GMAIL_|WEBHOOK_BASE_URL)" .env || echo "   No Gmail configuration found"
    
else
    echo "⚠️  No .env file found. Make sure you have one with your Gmail configuration."
fi

echo
echo "🔍 Understanding the Issue:"
echo "=========================="
echo "• Google Cloud Pub/Sub sends push notifications without custom tokens by default"
echo "• If you set GMAIL_WEBHOOK_TOKEN, the system expects Google to send it"
echo "• But Google doesn't send custom tokens unless you specifically configure them"
echo "• The fix: make token validation optional when Google doesn't send tokens"

echo
echo "🚀 Next Steps:"
echo "============="
echo "1. Restart your server: npm run start:dev"
echo "2. Check the logs for successful webhook processing"
echo "3. You should now see: 'ℹ️ Webhook token configured but not present in message (normal for Google Pub/Sub)'"
echo
echo "📚 For more details, see: guides/email-system/WEBHOOK_AUTHENTICATION_GUIDE.md"
echo
echo "✨ Done! Your webhook should now accept Google's push notifications." 
#!/bin/bash

# Gmail Webhook Authentication Fix Script
# This script helps fix the webhook authentication issue

echo "🔧 Gmail Webhook Authentication Fix"
echo "=================================="
echo

# Check if .env file exists
if [ -f ".env" ]; then
    echo "📋 Checking your .env file..."
    
    # Check for the problematic GMAIL_WEBHOOK_SECRET
    if grep -q "GMAIL_WEBHOOK_SECRET" .env; then
        echo "❌ Found GMAIL_WEBHOOK_SECRET in .env file"
        echo "   This is causing the webhook authentication to fail."
        echo
        read -p "🔨 Remove GMAIL_WEBHOOK_SECRET from .env? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Backup the original .env
            cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
            echo "💾 Backed up .env to .env.backup.$(date +%Y%m%d_%H%M%S)"
            
            # Remove the problematic line
            sed -i.tmp '/GMAIL_WEBHOOK_SECRET/d' .env && rm .env.tmp
            echo "✅ Removed GMAIL_WEBHOOK_SECRET from .env"
        else
            echo "⚠️  Please manually remove GMAIL_WEBHOOK_SECRET from your .env file"
        fi
    else
        echo "✅ No GMAIL_WEBHOOK_SECRET found in .env - good!"
    fi
    
    echo
    echo "📋 Current Gmail configuration:"
    echo "-----------------------------"
    grep -E "^(GOOGLE_CLOUD_PROJECT_ID|GMAIL_|WEBHOOK_BASE_URL)" .env || echo "   No Gmail configuration found"
    
else
    echo "⚠️  No .env file found. Make sure you have one with your Gmail configuration."
fi

echo
echo "🔧 Optional: Enhanced Security Setup"
echo "==================================="
echo "For production environments, you can add optional token authentication:"
echo
echo "GMAIL_WEBHOOK_TOKEN=your-secure-random-token-here"
echo
read -p "🔐 Add optional webhook token? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Generate a random token
    TOKEN=$(openssl rand -hex 32)
    echo "GMAIL_WEBHOOK_TOKEN=$TOKEN" >> .env
    echo "✅ Added GMAIL_WEBHOOK_TOKEN to .env file"
    echo "🔑 Token: $TOKEN"
    echo "   (This is optional and provides additional security)"
fi

echo
echo "🚀 Next Steps:"
echo "============="
echo "1. Restart your server: npm run start:dev"
echo "2. Check the logs for successful webhook processing"
echo "3. Test with: POST /gmail/client/test-push-notification"
echo
echo "📚 For more details, see: guides/email-system/WEBHOOK_AUTHENTICATION_GUIDE.md"
echo
echo "✨ Done! Your webhook authentication should now work with Google Pub/Sub." 
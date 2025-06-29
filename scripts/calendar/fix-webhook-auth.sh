#!/bin/bash

# Calendar Webhook Authentication Fix Script
# This script helps fix calendar webhook authentication issues

echo "🔧 Calendar Webhook Authentication Fix"
echo "====================================="
echo

# Check if .env file exists
if [ -f ".env" ]; then
    echo "📋 Checking your .env file for calendar webhook configuration..."
    
    # Check for the problematic CALENDAR_WEBHOOK_SECRET
    if grep -q "CALENDAR_WEBHOOK_SECRET" .env; then
        echo "❌ Found CALENDAR_WEBHOOK_SECRET in .env file"
        echo "   This might be causing webhook authentication to fail."
        echo "   Google Calendar webhooks don't use custom secrets by default."
        echo
        read -p "🔨 Remove CALENDAR_WEBHOOK_SECRET from .env? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Backup the original .env
            cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
            echo "💾 Backed up .env to .env.backup.$(date +%Y%m%d_%H%M%S)"
            
            # Remove the problematic line
            sed -i.tmp '/CALENDAR_WEBHOOK_SECRET/d' .env && rm .env.tmp
            echo "✅ Removed CALENDAR_WEBHOOK_SECRET from .env"
        else
            echo "⚠️  Please manually remove CALENDAR_WEBHOOK_SECRET from your .env file"
        fi
    else
        echo "✅ No CALENDAR_WEBHOOK_SECRET found in .env - good!"
    fi
    
    # Check for BASE_URL configuration
    if ! grep -q "BASE_URL" .env; then
        echo "⚠️  BASE_URL not found in .env"
        echo "   This is required for Google Calendar webhooks"
        echo
        read -p "Enter your BASE_URL (https required): " BASE_URL
        
        if [ -n "$BASE_URL" ]; then
            # Remove trailing slash
            BASE_URL=${BASE_URL%/}
            echo "BASE_URL=$BASE_URL" >> .env
            echo "✅ Added BASE_URL to .env"
        fi
    else
        BASE_URL=$(grep "BASE_URL" .env | cut -d '=' -f2)
        echo "✅ BASE_URL found: $BASE_URL"
        
        # Validate HTTPS for production
        if [[ ! "$BASE_URL" =~ ^https:// ]] && [[ ! "$BASE_URL" =~ localhost ]] && [[ ! "$BASE_URL" =~ ngrok ]]; then
            echo "⚠️  BASE_URL should use HTTPS for Google Calendar webhooks"
            echo "   Current: $BASE_URL"
            echo "   Google Calendar requires HTTPS for webhook endpoints"
        fi
    fi
    
    echo
    echo "📋 Current Calendar configuration:"
    echo "--------------------------------"
    grep -E "^(BASE_URL|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|CALENDAR_WEBHOOK_TOKEN)" .env 2>/dev/null || echo "   No Calendar configuration found"
    
else
    echo "⚠️  No .env file found. Make sure you have one with your calendar configuration."
fi

echo
echo "🔧 Optional: Enhanced Security Setup"
echo "==================================="
echo "For production environments, you can add optional token authentication:"
echo

# Check if CALENDAR_WEBHOOK_TOKEN exists
if ! grep -q "CALENDAR_WEBHOOK_TOKEN" .env 2>/dev/null; then
    read -p "🔐 Add optional webhook token for enhanced security? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Generate a random token
        TOKEN=$(openssl rand -hex 32)
        echo "CALENDAR_WEBHOOK_TOKEN=$TOKEN" >> .env
        echo "✅ Added CALENDAR_WEBHOOK_TOKEN to .env file"
        echo "🔑 Token: $TOKEN"
        echo "   (This provides additional security for your webhooks)"
        echo
        echo "📝 Don't forget to configure this token in your Google Calendar push notification setup!"
    fi
else
    echo "✅ CALENDAR_WEBHOOK_TOKEN already exists in .env"
fi

echo
echo "🔍 Understanding Calendar Webhook Authentication:"
echo "==============================================="
echo "• Google Calendar webhooks use channel-based authentication"
echo "• Each webhook includes headers like X-Goog-Channel-ID and X-Goog-Resource-State"
echo "• Optional: You can add custom tokens for additional security"
echo "• HTTPS is required for production webhook endpoints"
echo "• Domain verification is required in Google Cloud Console"

echo
echo "🧪 Testing Your Webhook:"
echo "======================="
echo "1. Set up push notifications:"
echo "   curl -X POST -H 'Authorization: Bearer <jwt_token>' \\"
echo "        'http://localhost:3000/calendar/notifications/setup'"
echo
echo "2. Check webhook health:"
echo "   curl -X POST 'http://localhost:3000/webhook/calendar/health'"
echo
echo "3. Simulate Google webhook:"
echo "   curl -X POST 'http://localhost:3000/webhook/calendar/google' \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -H 'X-Goog-Channel-ID: test-channel-123' \\"
echo "        -H 'X-Goog-Resource-State: exists' \\"
echo "        -H 'X-Goog-Resource-ID: test-resource-456'"

echo
echo "🚀 Next Steps:"
echo "============="
echo "1. Restart your server: npm run start:dev"
echo "2. Check the logs for successful webhook processing"
echo "3. Verify your domain in Google Cloud Console (for production)"
echo "4. Test calendar push notification setup"
echo
echo "📚 For more details, see: guides/calendar-workflow/GOOGLE-CALENDAR-PUSH-NOTIFICATIONS-SETUP.md"
echo
echo "✨ Done! Your calendar webhook authentication should now work with Google Calendar push notifications." 
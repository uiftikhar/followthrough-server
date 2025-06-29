#!/bin/bash

# Calendar Webhook Token Fix Script
# This script helps fix the calendar webhook token validation issue

echo "🔧 Calendar Webhook Token Fix"
echo "============================="
echo

# Check if .env file exists
if [ -f ".env" ]; then
    echo "📋 Checking your .env file for CALENDAR_WEBHOOK_TOKEN..."
    
    # Check for the CALENDAR_WEBHOOK_TOKEN
    if grep -q "CALENDAR_WEBHOOK_TOKEN" .env; then
        echo "⚠️  Found CALENDAR_WEBHOOK_TOKEN in .env file"
        echo "   Google Calendar webhooks don't send custom tokens by default."
        echo "   This might be causing webhook rejections."
        echo
        echo "Options:"
        echo "1. Remove CALENDAR_WEBHOOK_TOKEN (recommended for basic setup)"
        echo "2. Keep it (only works if you configure custom tokens in your webhook channel setup)"
        echo
        read -p "🔨 Remove CALENDAR_WEBHOOK_TOKEN from .env? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Backup the original .env
            cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
            echo "💾 Backed up .env to .env.backup.$(date +%Y%m%d_%H%M%S)"
            
            # Remove the token line
            sed -i.tmp '/CALENDAR_WEBHOOK_TOKEN/d' .env && rm .env.tmp
            echo "✅ Removed CALENDAR_WEBHOOK_TOKEN from .env"
            echo "   Your webhook will now accept Google's standard push notifications."
        else
            echo "⚠️  Keeping CALENDAR_WEBHOOK_TOKEN."
            echo "   Note: Google won't send this token unless you configure it in your webhook channel setup."
            echo "   The webhook has been updated to handle this gracefully."
        fi
    else
        echo "✅ No CALENDAR_WEBHOOK_TOKEN found in .env - good!"
        echo "   Your webhook will accept Google's standard push notifications."
    fi
    
    # Check for BASE_URL which is required
    if ! grep -q "BASE_URL" .env; then
        echo
        echo "⚠️  BASE_URL not found in .env but is required for calendar webhooks"
        read -p "Enter your BASE_URL (https required for production): " BASE_URL
        
        if [ -n "$BASE_URL" ]; then
            # Remove trailing slash
            BASE_URL=${BASE_URL%/}
            echo "BASE_URL=$BASE_URL" >> .env
            echo "✅ Added BASE_URL to .env"
        fi
    fi
    
    echo
    echo "📋 Current Calendar configuration:"
    echo "--------------------------------"
    grep -E "^(GOOGLE_CLOUD_PROJECT_ID|BASE_URL|GOOGLE_CLIENT_ID|CALENDAR_)" .env 2>/dev/null || echo "   No Calendar configuration found"
    
else
    echo "⚠️  No .env file found. Make sure you have one with your calendar configuration."
fi

echo
echo "🔍 Understanding the Issue:"
echo "=========================="
echo "• Google Calendar webhooks use channel-based authentication by default"
echo "• Each webhook includes standard headers (X-Goog-Channel-ID, X-Goog-Resource-State, etc.)"
echo "• Custom tokens (CALENDAR_WEBHOOK_TOKEN) are optional and not sent by Google by default"
echo "• If you set CALENDAR_WEBHOOK_TOKEN, the system expects Google to send it"
echo "• But Google doesn't send custom tokens unless you specifically configure them"
echo "• The fix: make token validation optional when Google doesn't send tokens"

echo
echo "🔧 How Google Calendar Webhooks Work:"
echo "===================================="
echo "1. You set up a webhook channel with Google Calendar API"
echo "2. Google sends notifications to your webhook endpoint"
echo "3. Each notification includes these headers:"
echo "   - X-Goog-Channel-ID: Your channel identifier"
echo "   - X-Goog-Resource-State: 'exists', 'not_exists', or 'sync'"
echo "   - X-Goog-Resource-ID: Google's resource identifier"
echo "   - X-Goog-Resource-URI: The calendar resource URI"
echo "4. Optional: You can include a custom token when setting up the channel"

echo
echo "🔐 Security Options:"
echo "==================="
echo "• Basic: Use Google's standard channel authentication (recommended to start)"
echo "• Enhanced: Add custom token validation (requires configuration in channel setup)"
echo "• Production: Add domain verification + HTTPS + custom tokens"

echo
echo "🚀 Next Steps:"
echo "============="
echo "1. Restart your server: npm run start:dev"
echo "2. Set up push notifications: POST /calendar/notifications/setup"
echo "3. Check the logs for successful webhook processing"
echo "4. You should now see: 'ℹ️ Calendar webhook token configured but not present in notification (normal for Google Calendar)'"
echo
echo "📚 Testing Commands:"
echo "==================="
echo "# Test webhook health"
echo "curl -X POST 'http://localhost:3000/webhook/calendar/health'"
echo
echo "# Set up push notifications (requires authentication)"
echo "curl -X POST -H 'Authorization: Bearer <jwt_token>' \\"
echo "     'http://localhost:3000/calendar/notifications/setup'"
echo
echo "# Check notification status"
echo "curl -H 'Authorization: Bearer <jwt_token>' \\"
echo "     'http://localhost:3000/calendar/notifications/status'"
echo
echo "📚 For more details, see: guides/calendar-workflow/GOOGLE-CALENDAR-PUSH-NOTIFICATIONS-SETUP.md"
echo
echo "✨ Done! Your webhook should now accept Google Calendar push notifications." 
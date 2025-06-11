#!/bin/bash

# Google Calendar OAuth Setup Script
# This script helps set up Google Calendar OAuth authentication

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗓️ Google Calendar OAuth Setup${NC}"
echo "================================"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating one...${NC}"
    touch .env
fi

echo -e "${BLUE}📋 Current Calendar OAuth configuration:${NC}"
echo "----------------------------------------"
grep -E "^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|GOOGLE_REDIRECT_URI|BASE_URL)" .env 2>/dev/null || echo "   No Calendar OAuth configuration found"

echo ""
echo -e "${BLUE}🔧 Setting up Google Calendar OAuth...${NC}"

# Check Google Client ID
if ! grep -q "GOOGLE_CLIENT_ID" .env; then
    echo -e "${YELLOW}⚠️  GOOGLE_CLIENT_ID not found in .env${NC}"
    echo "   Get this from: https://console.cloud.google.com"
    echo "   1. Go to 'APIs & Services' > 'Credentials'"
    echo "   2. Create OAuth 2.0 Client ID (Web application)"
    echo "   3. Copy the Client ID"
    echo ""
    read -p "Enter your Google Client ID: " CLIENT_ID
    
    if [ -n "$CLIENT_ID" ]; then
        echo "GOOGLE_CLIENT_ID=$CLIENT_ID" >> .env
        echo -e "${GREEN}✅ Added GOOGLE_CLIENT_ID to .env${NC}"
    fi
else
    echo -e "${GREEN}✅ GOOGLE_CLIENT_ID found in .env${NC}"
fi

# Check Google Client Secret
if ! grep -q "GOOGLE_CLIENT_SECRET" .env; then
    echo -e "${YELLOW}⚠️  GOOGLE_CLIENT_SECRET not found in .env${NC}"
    echo "   Get this from the same OAuth 2.0 Client in Google Cloud Console"
    echo ""
    read -p "Enter your Google Client Secret: " CLIENT_SECRET
    
    if [ -n "$CLIENT_SECRET" ]; then
        echo "GOOGLE_CLIENT_SECRET=$CLIENT_SECRET" >> .env
        echo -e "${GREEN}✅ Added GOOGLE_CLIENT_SECRET to .env${NC}"
    fi
else
    echo -e "${GREEN}✅ GOOGLE_CLIENT_SECRET found in .env${NC}"
fi

# Check BASE_URL
if ! grep -q "BASE_URL" .env; then
    echo -e "${YELLOW}⚠️  BASE_URL not found in .env${NC}"
    echo "   This should be your application's base URL (https required for production)"
    echo "   Example: https://your-domain.com or https://abc123.ngrok.io for development"
    echo ""
    read -p "Enter your BASE_URL: " BASE_URL
    
    if [ -n "$BASE_URL" ]; then
        # Remove trailing slash
        BASE_URL=${BASE_URL%/}
        echo "BASE_URL=$BASE_URL" >> .env
        echo -e "${GREEN}✅ Added BASE_URL to .env${NC}"
    fi
else
    BASE_URL=$(grep "BASE_URL" .env | cut -d '=' -f2)
    echo -e "${GREEN}✅ BASE_URL found in .env: $BASE_URL${NC}"
fi

# Set up redirect URI
REDIRECT_URI="$BASE_URL/oauth/google/callback"
if ! grep -q "GOOGLE_REDIRECT_URI" .env; then
    echo "GOOGLE_REDIRECT_URI=$REDIRECT_URI" >> .env
    echo -e "${GREEN}✅ Added GOOGLE_REDIRECT_URI to .env${NC}"
else
    echo -e "${GREEN}✅ GOOGLE_REDIRECT_URI found in .env${NC}"
fi

# Generate Calendar Webhook Token (optional security)
echo ""
echo -e "${BLUE}🔐 Calendar Webhook Security Setup${NC}"
if ! grep -q "CALENDAR_WEBHOOK_TOKEN" .env; then
    echo -e "${YELLOW}⚠️  Optional: Generate webhook authentication token?${NC}"
    echo "   This adds extra security to your calendar webhooks"
    echo ""
    read -p "Generate CALENDAR_WEBHOOK_TOKEN? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Generate a random token
        WEBHOOK_TOKEN=$(openssl rand -hex 32)
        echo "CALENDAR_WEBHOOK_TOKEN=$WEBHOOK_TOKEN" >> .env
        echo -e "${GREEN}✅ Added CALENDAR_WEBHOOK_TOKEN to .env${NC}"
        echo -e "${BLUE}🔑 Token: $WEBHOOK_TOKEN${NC}"
    fi
else
    echo -e "${GREEN}✅ CALENDAR_WEBHOOK_TOKEN found in .env${NC}"
fi

# Check required calendar scopes
echo ""
echo -e "${BLUE}📝 Required OAuth Scopes${NC}"
echo "========================="
echo "Make sure your Google OAuth app has these scopes configured:"
echo "  ✅ https://www.googleapis.com/auth/calendar.readonly"
echo "  ✅ https://www.googleapis.com/auth/calendar.events"
echo ""
echo "To configure scopes:"
echo "  1. Go to https://console.cloud.google.com"
echo "  2. Navigate to 'APIs & Services' > 'Credentials'"
echo "  3. Edit your OAuth 2.0 Client ID"
echo "  4. Add the authorized redirect URI: $REDIRECT_URI"
echo "  5. In 'OAuth consent screen', add the required scopes"

# SSL Certificate reminder
echo ""
echo -e "${BLUE}🔒 SSL Certificate Requirements${NC}"
echo "=================================="
BASE_URL_CHECK=$(grep "BASE_URL" .env | cut -d '=' -f2)
if [[ "$BASE_URL_CHECK" =~ ^https:// ]]; then
    echo -e "${GREEN}✅ BASE_URL uses HTTPS - good for production${NC}"
    echo "   Make sure you have a valid SSL certificate"
else
    echo -e "${YELLOW}⚠️  BASE_URL uses HTTP - only suitable for development${NC}"
    echo "   For production, you need HTTPS and a valid SSL certificate"
fi

# Development vs Production setup
echo ""
echo -e "${BLUE}🚀 Development vs Production Setup${NC}"
echo "=================================="
if [[ "$BASE_URL_CHECK" =~ ngrok ]]; then
    echo -e "${YELLOW}📱 Development Setup Detected (ngrok)${NC}"
    echo "   Perfect for testing calendar webhooks!"
    echo "   Your webhook URL: $BASE_URL_CHECK/webhook/calendar/google"
elif [[ "$BASE_URL_CHECK" =~ localhost ]]; then
    echo -e "${RED}❌ Localhost detected - Google Calendar webhooks won't work${NC}"
    echo "   Use ngrok for development: ngrok http 3000"
    echo "   Then update BASE_URL to your ngrok URL"
else
    echo -e "${GREEN}🏭 Production Setup Detected${NC}"
    echo "   Make sure your domain is verified in Google Cloud Console"
    echo "   Webhook URL: $BASE_URL_CHECK/webhook/calendar/google"
fi

# Display final configuration
echo ""
echo -e "${GREEN}🎉 Calendar OAuth Setup Complete!${NC}"
echo "=================================="
echo ""
echo -e "${BLUE}📋 Final Configuration:${NC}"
grep -E "^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|GOOGLE_REDIRECT_URI|BASE_URL|CALENDAR_WEBHOOK_TOKEN)" .env

echo ""
echo -e "${BLUE}🔧 Next Steps:${NC}"
echo "============="
echo "  1. Start your server: npm run start:dev"
echo "  2. Test OAuth flow: GET /oauth/google/authorize"
echo "  3. Set up push notifications: POST /calendar/notifications/setup"
echo "  4. Verify webhook endpoint: $BASE_URL_CHECK/webhook/calendar/google"
echo ""
echo -e "${BLUE}📚 Testing Commands:${NC}"
echo "==================="
echo "  # Test OAuth authorization"
echo "  curl 'http://localhost:3000/oauth/google/authorize'"
echo ""
echo "  # After OAuth, test calendar sync"
echo "  curl -H 'Authorization: Bearer <jwt_token>' 'http://localhost:3000/calendar/sync'"
echo ""
echo "  # Setup push notifications"
echo "  curl -X POST -H 'Authorization: Bearer <jwt_token>' 'http://localhost:3000/calendar/notifications/setup'"
echo ""
echo -e "${YELLOW}⚠️  Important Security Notes:${NC}"
echo "  - Keep your .env file secure and never commit it to version control"
echo "  - Use strong, unique secrets for production"
echo "  - Regularly rotate your OAuth credentials"
echo "  - Monitor OAuth usage in Google Cloud Console"
echo ""
echo -e "${GREEN}Setup completed successfully! 🚀${NC}" 
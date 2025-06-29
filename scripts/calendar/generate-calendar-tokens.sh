#!/bin/bash

# Calendar Token Generation Script
# This script generates secure tokens for calendar webhook authentication

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Calendar Token Generation${NC}"
echo "============================"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating one...${NC}"
    touch .env
fi

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}❌ Error: openssl is not installed${NC}"
    echo "Please install openssl to generate secure tokens"
    exit 1
fi

echo -e "${BLUE}📋 Current Calendar token configuration:${NC}"
echo "---------------------------------------"
grep -E "^(CALENDAR_WEBHOOK_TOKEN|JWT_SECRET|GOOGLE_TOKEN_ENCRYPTION_KEY)" .env 2>/dev/null || echo "   No token configuration found"

echo ""
echo -e "${BLUE}🔧 Generating Calendar Tokens...${NC}"

# Generate Calendar Webhook Token
if ! grep -q "CALENDAR_WEBHOOK_TOKEN" .env; then
    echo -e "${YELLOW}🔑 Generating CALENDAR_WEBHOOK_TOKEN...${NC}"
    WEBHOOK_TOKEN=$(openssl rand -hex 32)
    echo "CALENDAR_WEBHOOK_TOKEN=$WEBHOOK_TOKEN" >> .env
    echo -e "${GREEN}✅ Added CALENDAR_WEBHOOK_TOKEN to .env${NC}"
    echo -e "${BLUE}   Token: $WEBHOOK_TOKEN${NC}"
else
    echo -e "${GREEN}✅ CALENDAR_WEBHOOK_TOKEN already exists${NC}"
    EXISTING_TOKEN=$(grep "CALENDAR_WEBHOOK_TOKEN" .env | cut -d '=' -f2)
    echo -e "${BLUE}   Current token: $EXISTING_TOKEN${NC}"
    
    read -p "🔄 Regenerate CALENDAR_WEBHOOK_TOKEN? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        NEW_WEBHOOK_TOKEN=$(openssl rand -hex 32)
        sed -i.tmp "s/CALENDAR_WEBHOOK_TOKEN=.*/CALENDAR_WEBHOOK_TOKEN=$NEW_WEBHOOK_TOKEN/" .env && rm .env.tmp
        echo -e "${GREEN}✅ Regenerated CALENDAR_WEBHOOK_TOKEN${NC}"
        echo -e "${BLUE}   New token: $NEW_WEBHOOK_TOKEN${NC}"
    fi
fi

# Generate JWT Secret if not exists
if ! grep -q "JWT_SECRET" .env; then
    echo -e "${YELLOW}🔑 Generating JWT_SECRET...${NC}"
    JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-32)
    echo "JWT_SECRET=$JWT_SECRET" >> .env
    echo -e "${GREEN}✅ Added JWT_SECRET to .env${NC}"
    echo -e "${BLUE}   Secret: $JWT_SECRET${NC}"
else
    echo -e "${GREEN}✅ JWT_SECRET already exists${NC}"
fi

# Generate Google Token Encryption Key
if ! grep -q "GOOGLE_TOKEN_ENCRYPTION_KEY" .env; then
    echo -e "${YELLOW}🔑 Generating GOOGLE_TOKEN_ENCRYPTION_KEY...${NC}"
    ENCRYPTION_KEY=$(openssl rand -hex 16)
    echo "GOOGLE_TOKEN_ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
    echo -e "${GREEN}✅ Added GOOGLE_TOKEN_ENCRYPTION_KEY to .env${NC}"
    echo -e "${BLUE}   Key: $ENCRYPTION_KEY${NC}"
else
    echo -e "${GREEN}✅ GOOGLE_TOKEN_ENCRYPTION_KEY already exists${NC}"
    
    read -p "🔄 Regenerate GOOGLE_TOKEN_ENCRYPTION_KEY? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        NEW_ENCRYPTION_KEY=$(openssl rand -hex 16)
        sed -i.tmp "s/GOOGLE_TOKEN_ENCRYPTION_KEY=.*/GOOGLE_TOKEN_ENCRYPTION_KEY=$NEW_ENCRYPTION_KEY/" .env && rm .env.tmp
        echo -e "${GREEN}✅ Regenerated GOOGLE_TOKEN_ENCRYPTION_KEY${NC}"
        echo -e "${BLUE}   New key: $NEW_ENCRYPTION_KEY${NC}"
        echo -e "${YELLOW}⚠️  Note: This will invalidate all existing Google tokens. Users will need to re-authenticate.${NC}"
    fi
fi

# Generate API Key for internal services
if ! grep -q "CALENDAR_API_KEY" .env; then
    echo -e "${YELLOW}🔑 Generating CALENDAR_API_KEY...${NC}"
    API_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-24)
    echo "CALENDAR_API_KEY=$API_KEY" >> .env
    echo -e "${GREEN}✅ Added CALENDAR_API_KEY to .env${NC}"
    echo -e "${BLUE}   Key: $API_KEY${NC}"
else
    echo -e "${GREEN}✅ CALENDAR_API_KEY already exists${NC}"
fi

# Generate Channel Secret for Google Calendar push notifications
if ! grep -q "CALENDAR_CHANNEL_SECRET" .env; then
    echo -e "${YELLOW}🔑 Generating CALENDAR_CHANNEL_SECRET...${NC}"
    CHANNEL_SECRET=$(openssl rand -hex 24)
    echo "CALENDAR_CHANNEL_SECRET=$CHANNEL_SECRET" >> .env
    echo -e "${GREEN}✅ Added CALENDAR_CHANNEL_SECRET to .env${NC}"
    echo -e "${BLUE}   Secret: $CHANNEL_SECRET${NC}"
else
    echo -e "${GREEN}✅ CALENDAR_CHANNEL_SECRET already exists${NC}"
fi

echo ""
echo -e "${BLUE}🔐 Security Configuration Summary${NC}"
echo "================================"
echo "✅ CALENDAR_WEBHOOK_TOKEN - Webhook authentication"
echo "✅ JWT_SECRET - JWT token signing"
echo "✅ GOOGLE_TOKEN_ENCRYPTION_KEY - Google token encryption"
echo "✅ CALENDAR_API_KEY - Internal API authentication"
echo "✅ CALENDAR_CHANNEL_SECRET - Google Calendar channel security"

echo ""
echo -e "${BLUE}📋 Current Configuration:${NC}"
grep -E "^(CALENDAR_WEBHOOK_TOKEN|JWT_SECRET|GOOGLE_TOKEN_ENCRYPTION_KEY|CALENDAR_API_KEY|CALENDAR_CHANNEL_SECRET)" .env

echo ""
echo -e "${BLUE}🔧 Usage in Application:${NC}"
echo "========================="
echo "These tokens are used for:"
echo ""
echo "• CALENDAR_WEBHOOK_TOKEN:"
echo "  - Validates incoming Google Calendar webhook notifications"
echo "  - Include in X-Goog-Channel-Token header when setting up channels"
echo ""
echo "• JWT_SECRET:"
echo "  - Signs and verifies JWT tokens for user authentication"
echo "  - Used across all authentication middleware"
echo ""
echo "• GOOGLE_TOKEN_ENCRYPTION_KEY:"
echo "  - Encrypts Google OAuth tokens before storing in database"
echo "  - Ensures token security at rest"
echo ""
echo "• CALENDAR_API_KEY:"
echo "  - Authenticates internal service-to-service communications"
echo "  - Used for background calendar operations"
echo ""
echo "• CALENDAR_CHANNEL_SECRET:"
echo "  - Additional security for Google Calendar push notification channels"
echo "  - Used in channel verification and validation"

echo ""
echo -e "${BLUE}🧪 Testing Your Tokens:${NC}"
echo "======================="
echo "1. Test webhook authentication:"
echo "   curl -X POST 'http://localhost:3000/webhook/calendar/google' \\"
echo "        -H 'X-Goog-Channel-Token: \$CALENDAR_WEBHOOK_TOKEN' \\"
echo "        -H 'X-Goog-Channel-ID: test-channel'"
echo ""
echo "2. Test API key authentication:"
echo "   curl -H 'X-API-Key: \$CALENDAR_API_KEY' \\"
echo "        'http://localhost:3000/calendar/health'"
echo ""
echo "3. Test JWT token (after getting one from OAuth):"
echo "   curl -H 'Authorization: Bearer <jwt_token>' \\"
echo "        'http://localhost:3000/calendar/sync'"

echo ""
echo -e "${YELLOW}⚠️  Security Best Practices:${NC}"
echo "============================"
echo "• Never commit .env files to version control"
echo "• Use different tokens for development, staging, and production"
echo "• Rotate tokens regularly (recommended: every 90 days)"
echo "• Monitor token usage in application logs"
echo "• Use environment-specific secrets management in production"
echo "• Keep backup of tokens in secure location"

echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo "=============="
echo "1. Restart your server to load new tokens: npm run start:dev"
echo "2. Set up Google Calendar OAuth: scripts/calendar/setup-calendar-auth.sh"
echo "3. Configure Google Cloud Pub/Sub: scripts/calendar/setup-calendar-pubsub.sh"
echo "4. Test calendar webhook setup: POST /calendar/notifications/setup"

echo ""
echo -e "${GREEN}🎉 Token generation completed successfully! 🔐${NC}"
echo ""
echo -e "${BLUE}📝 Remember to backup your .env file securely!${NC}" 
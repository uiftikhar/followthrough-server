# FollowThrough AI Zapier Integration - Setup Guide

## Prerequisites

1. **FollowThrough AI Server**: Your server must be running and accessible
2. **Zapier Developer Account**: Sign up at [developer.zapier.com](https://developer.zapier.com)
3. **Google OAuth Credentials**: Set up in Google Cloud Console

## Step 1: Get Your FollowThrough API Key

The `FOLLOWTHROUGH_API_KEY` is generated from your FollowThrough AI server:

### Method 1: Via API (Recommended)
```bash
# First, authenticate with your server and get a JWT token
curl -X POST "https://your-server.com/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com", "password": "your-password"}'

# Use the JWT token to generate a Zapier API key
curl -X POST "https://your-server.com/api/zapier/api-key" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Method 2: Via Dashboard
1. Log into your FollowThrough AI dashboard
2. Navigate to Settings > Integrations > Zapier
3. Click "Generate API Key"
4. Copy the generated key (starts with `zapier_`)

## Step 2: Register Your Zapier App

```bash
# Install Zapier CLI globally
npm install -g zapier-platform-cli

# Login to Zapier
zapier login

# Register your app (this gives you the app ID)
zapier register "FollowThrough AI Integration"
```

After registration, Zapier will create a `.zapierapprc` file with your app ID:
```json
{
  "id": 123456,
  "key": "followthrough-ai-integration"
}
```

**Note**: The `id` number is specific and assigned by Zapier. You cannot choose this number.

## Step 3: Configure Environment Variables

Create a `.env` file in the package root:

```bash
# FollowThrough AI Server
FOLLOWTHROUGH_API_URL=https://your-server.com
FOLLOWTHROUGH_API_KEY=zapier_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://zapier.com/dashboard/auth/oauth/return/App123456CLIAPI/

# Zapier
ZAPIER_DEPLOY_KEY=your-zapier-deploy-key
```

## Step 4: Build and Test

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Test the integration
npm test

# Validate the package
npm run validate
```

## Step 5: Deploy to Zapier

```bash
# Deploy to development environment
npm run push

# Test specific components
zapier test --trigger=new_email
zapier test --action=triggerEmailTriage
```

## Troubleshooting

### Common Issues

1. **"Cannot find module" error**: Run `npm run build` first
2. **API Key not working**: Ensure your server is running and the key is valid
3. **OAuth errors**: Check your Google Cloud Console configuration
4. **Version conflicts**: Ensure you're using `zapier-platform-core@16.9.0`

### Testing Your API Key

```bash
# Test your API key works
curl -X GET "https://your-server.com/api/zapier/test" \
  -H "x-api-key: your-zapier-api-key"
```

### Checking Server Endpoints

Ensure these endpoints are available on your server:
- `GET /oauth/google/authorize`
- `POST /oauth/google/token`
- `GET /oauth/google/test`
- `POST /api/zapier/webhooks/email`
- `POST /api/zapier/webhooks/meeting`
- `GET /api/gmail/messages`
- `POST /api/gmail/send`
- `GET /api/calendar/events`
- `POST /api/calendar/events`

## Next Steps

1. Test the integration thoroughly
2. Create sample Zaps for testing
3. Submit for Zapier review when ready
4. Monitor usage and performance

For more details, see the [DEPLOYMENT.md](./DEPLOYMENT.md) guide. 
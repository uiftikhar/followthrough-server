# Google Calendar Integration Setup Scripts

This directory contains scripts to set up Google Calendar integration for the FollowThrough AI calendar workflow.

## 🚀 Quick Start

To set up everything at once:

```bash
./scripts/calendar/setup-calendar-complete.sh
```

## 📋 Individual Scripts

### 1. **generate-calendar-tokens.sh** 🔐
Generates all necessary security tokens for calendar integration.

**What it does:**
- Creates `CALENDAR_WEBHOOK_TOKEN` for webhook authentication
- Generates `JWT_SECRET` for JWT token signing
- Creates `GOOGLE_TOKEN_ENCRYPTION_KEY` for Google token encryption
- Generates `CALENDAR_API_KEY` for internal API authentication
- Creates `CALENDAR_CHANNEL_SECRET` for Google Calendar channel security

```bash
./scripts/calendar/generate-calendar-tokens.sh
```

### 2. **setup-calendar-auth.sh** 🔑
Sets up Google OAuth authentication for calendar access.

**What it does:**
- Prompts for Google Client ID and Secret
- Configures OAuth redirect URIs
- Sets up BASE_URL for webhook endpoints
- Validates HTTPS requirements for production

```bash
./scripts/calendar/setup-calendar-auth.sh
```

### 3. **setup-calendar-pubsub.sh** ☁️
Sets up Google Cloud Pub/Sub infrastructure for reliable webhook delivery.

**What it does:**
- Creates Google Cloud Pub/Sub topics and subscriptions
- Sets up service accounts with proper permissions
- Configures push endpoints for webhook notifications
- Enables required Google Cloud APIs

```bash
./scripts/calendar/setup-calendar-pubsub.sh
```

### 4. **fix-webhook-auth.sh** 🔧
Fixes common webhook authentication issues.

**What it does:**
- Removes problematic `CALENDAR_WEBHOOK_SECRET` if present
- Validates BASE_URL configuration
- Optionally adds enhanced security tokens
- Provides troubleshooting guidance

```bash
./scripts/calendar/fix-webhook-auth.sh
```

### 5. **fix-webhook-token.sh** 🔧
Fixes webhook token validation issues.

**What it does:**
- Handles `CALENDAR_WEBHOOK_TOKEN` configuration issues
- Explains Google Calendar webhook authentication
- Provides testing commands
- Offers security options

```bash
./scripts/calendar/fix-webhook-token.sh
```

### 6. **setup-calendar-complete.sh** 🎯
Master script that runs all setup scripts in the correct order.

**What it does:**
- Orchestrates the complete setup process
- Runs all individual scripts in sequence
- Validates final configuration
- Provides next steps and testing commands

```bash
./scripts/calendar/setup-calendar-complete.sh
```

## 🔍 What Gets Configured

After running the scripts, your `.env` file will contain:

### Required Configuration
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
BASE_URL=https://your-domain.com
JWT_SECRET=generated_jwt_secret
GOOGLE_TOKEN_ENCRYPTION_KEY=generated_encryption_key
```

### Optional Security Configuration
```env
CALENDAR_WEBHOOK_TOKEN=generated_webhook_token
CALENDAR_API_KEY=generated_api_key
CALENDAR_CHANNEL_SECRET=generated_channel_secret
```

### Google Cloud Configuration (if using Pub/Sub)
```env
GOOGLE_CLOUD_PROJECT_ID=your_project_id
CALENDAR_PUBSUB_TOPIC=calendar-notifications
CALENDAR_PUSH_SUBSCRIPTION=calendar-push-notification-subscription
GOOGLE_APPLICATION_CREDENTIALS=./config/calendar-push-service-account.json
```

## 🧪 Testing Your Setup

After running the scripts, test your configuration:

```bash
# 1. Start your server
npm run start:dev

# 2. Test OAuth flow
curl 'http://localhost:3000/oauth/google/authorize'

# 3. Test calendar sync (after OAuth)
curl -H 'Authorization: Bearer <jwt_token>' 'http://localhost:3000/calendar/sync'

# 4. Set up push notifications
curl -X POST -H 'Authorization: Bearer <jwt_token>' 'http://localhost:3000/calendar/notifications/setup'

# 5. Test webhook health
curl -X POST 'http://localhost:3000/webhook/calendar/health'
```

## 🔐 Security Notes

- **Never commit `.env` files** to version control
- Use **different tokens** for development, staging, and production
- **Rotate tokens regularly** (recommended: every 90 days)
- **Monitor token usage** in application logs
- Use **HTTPS** for production webhook endpoints
- **Verify your domain** in Google Cloud Console

## 📚 Documentation

- [Google Calendar Push Notifications Setup](../../guides/calendar-workflow/GOOGLE-CALENDAR-PUSH-NOTIFICATIONS-SETUP.md)
- [Implementation Status](../../guides/calendar-workflow/IMPLEMENTATION-STATUS-UPDATE.md)
- [Calendar Workflow Development Guide](../../guides/calendar-workflow/CALENDAR-WORKFLOW-DEVELOPMENT-GUIDE.md)

## 🐛 Troubleshooting

### Common Issues

1. **Webhook not receiving notifications**
   - Run `./scripts/calendar/fix-webhook-auth.sh`
   - Ensure BASE_URL uses HTTPS
   - Verify domain in Google Cloud Console

2. **Authentication failures**
   - Run `./scripts/calendar/fix-webhook-token.sh`
   - Check Google OAuth credentials
   - Verify required scopes are granted

3. **Token validation errors**
   - Regenerate tokens with `./scripts/calendar/generate-calendar-tokens.sh`
   - Restart your server after token changes

### Support

For additional help:
- Check the logs for detailed error messages
- Review the documentation in `guides/calendar-workflow/`
- Run the fix scripts for common issues

## 🚀 Next Steps

After setup is complete:

1. **Configure Google Cloud Console**
   - Add authorized redirect URIs
   - Set up domain verification
   - Configure OAuth consent screen

2. **Test with ngrok** (for development)
   ```bash
   ngrok http 3000
   # Update BASE_URL to your ngrok URL
   ```

3. **Set up production HTTPS**
   - Obtain SSL certificate
   - Configure reverse proxy
   - Update BASE_URL to production domain

4. **Monitor and maintain**
   - Set up log monitoring
   - Schedule token rotation
   - Monitor webhook delivery rates 
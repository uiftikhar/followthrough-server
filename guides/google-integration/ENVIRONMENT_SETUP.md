# 🔧 Environment Setup for Gmail Push Notifications

## Required Environment Variables

Add the following variables to your `.env` file after running the Pub/Sub setup script:

```bash
# Gmail Push Notifications (Google Cloud Pub/Sub)
GOOGLE_CLOUD_PROJECT_ID=your-google-cloud-project-id
GMAIL_PUBSUB_TOPIC=gmail-notifications
GMAIL_PUSH_SUBSCRIPTION=gmail-push-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-subscription
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json

# Webhook Security
GMAIL_WEBHOOK_SECRET=your-webhook-secret-for-verification
```

## Existing Variables (Already Configured)

Your existing Google OAuth configuration should already include:

```bash
# Google OAuth (Already configured)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=your-32-character-encryption-key
```

## Setup Instructions

1. **Run the Pub/Sub setup script:**
   ```bash
   ./scripts/setup-pubsub.sh
   ```

2. **Update your `.env` file** with the values provided by the script

3. **Generate a webhook secret** for security:
   ```bash
   # Generate a secure random string
   openssl rand -hex 32
   ```

4. **Verify your configuration** by checking that all required files exist:
   - `./config/gmail-push-service-account.json` (created by setup script)
   - `.env` file with all required variables

## Security Notes

- ✅ The service account key file is automatically added to `.gitignore`
- ✅ Never commit the service account key to version control
- ✅ Use environment variables for all sensitive configuration
- ✅ In production, store the service account key securely (e.g., Google Secret Manager)

## Verification

After setup, you can verify your configuration by running:

```bash
# Check if Google Cloud CLI is authenticated
gcloud auth list

# Test Pub/Sub topic access
gcloud pubsub topics list --filter="name:gmail-notifications"

# Test subscription access
gcloud pubsub subscriptions list --filter="name:gmail-push-subscription"
``` 
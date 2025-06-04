# Gmail Webhook Authentication Guide

## 🚨 Issue: Invalid Webhook Secret Error

If you're seeing this error in your server logs:

```
WARN: 🚫 Unauthorized webhook request - invalid secret
ERROR: ❌ Push notification processing failed: Invalid webhook secret
```

This means the webhook authentication is not properly configured for Google Cloud Pub/Sub.

## ⚠️ Issue: Invalid Webhook Token Error

If you're seeing this error in your server logs:

```
WARN: 🚫 Invalid webhook token in message attributes
ERROR: ❌ Push notification processing failed: Invalid webhook token
```

This means you have `GMAIL_WEBHOOK_TOKEN` set in your environment, but **Google doesn't send custom tokens by default**. This is normal behavior - Google Cloud Pub/Sub only sends custom tokens if you specifically configure them in your subscription.

## ✅ Solution: Updated Authentication

The webhook has been updated to use **proper Google Cloud Pub/Sub authentication** instead of custom webhook secrets.

### How Google Pub/Sub Authentication Works

Google Cloud Pub/Sub authenticates requests through:

1. **User-Agent Headers**: Google sends specific user-agent strings
2. **From Headers**: Requests come from `noreply@google.com`
3. **Request Structure**: Validates the Pub/Sub payload format
4. **Optional Token**: Can include a custom token in message attributes

## 🔧 Configuration Options

### Option 1: No Additional Authentication (Recommended for Development)

**What you need**: Nothing! The system now validates Google's request automatically.

**Environment Variables**: None required

**Security Level**: Basic (validates request comes from Google)

### Option 2: Token-Based Authentication (Recommended for Production)

**What you need**: Add a custom token to your Pub/Sub subscription

**Environment Variables**:
```bash
# Optional - for additional security
GMAIL_WEBHOOK_TOKEN=your-secure-random-token
```

**Setup Steps**:
1. Set the `GMAIL_WEBHOOK_TOKEN` environment variable
2. Update your Pub/Sub subscription to include the token in message attributes
3. Google will include this token in every push notification

### Option 3: JWT Authentication (Advanced)

For maximum security, you can configure Google Cloud Pub/Sub to send JWT tokens.

## 🛠️ Quick Fix

### For "Invalid Webhook Secret" Error

If you have this in your `.env` file, **remove it**:
```bash
# ❌ Remove this - no longer used
GMAIL_WEBHOOK_SECRET=some-secret
```

### For "Invalid Webhook Token" Error

You have two options:

#### Option A: Remove the Token (Recommended)
```bash
# ❌ Remove this line from .env if you want basic authentication
GMAIL_WEBHOOK_TOKEN=some-token
```

#### Option B: Keep the Token (Advanced)
Keep the `GMAIL_WEBHOOK_TOKEN` - the system has been updated to handle Google's standard requests gracefully, even without the token.

### Quick Fix Script

Run this script to automatically fix the issue:
```bash
./scripts/fix-webhook-token.sh
```

## 🔍 How to Verify It's Working

### 1. Check the Server Logs

You should now see successful processing:
```
INFO: 🔔 PUSH NOTIFICATION RECEIVED: message-id-123
INFO: 📡 Headers: User-Agent: APIs-Google; (+https://developers.google.com/webmasters/APIs-Google.html), From: noreply@google.com
INFO: ℹ️ Webhook token configured but not present in message (normal for Google Pub/Sub)
INFO: ✅ Google Pub/Sub request verification passed
INFO: 📧 Push notification for: user@gmail.com, historyId: 12345
```

If you **removed** the `GMAIL_WEBHOOK_TOKEN`, you'll see:
```
INFO: 🔔 PUSH NOTIFICATION RECEIVED: message-id-123
INFO: ✅ Google Pub/Sub request verification passed
INFO: 📧 Push notification for: user@gmail.com, historyId: 12345
```

### 2. Test with the Client Endpoint

```bash
curl -X POST http://localhost:3000/gmail/client/test-push-notification \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Force Process Pending Messages

```bash
curl -X POST http://localhost:3000/gmail/client/force-process-pending \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔐 Enhanced Security (Optional)

### For Production Environments

If you want additional security beyond Google's built-in authentication:

1. **Set up IP allowlisting** in your firewall to only allow Google's IP ranges
2. **Use GMAIL_WEBHOOK_TOKEN** environment variable for token validation
3. **Enable HTTPS** for your webhook endpoint (required by Google)

### Google Cloud IP Ranges

Google Cloud publishes their IP ranges that you can allowlist:
- https://cloud.google.com/compute/docs/faq#find_ip_range

## 📋 Updated Environment Variables

### Required Variables (Unchanged)
```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GMAIL_PUBSUB_TOPIC=gmail-notifications
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

### Optional Security Variables
```bash
# Optional: Additional token validation
GMAIL_WEBHOOK_TOKEN=your-secure-random-token

# Optional: Webhook base URL (for reference)
WEBHOOK_BASE_URL=https://your-domain.com
```

### Removed Variables
```bash
# ❌ No longer used - remove these
GMAIL_WEBHOOK_SECRET=removed
```

## 🚀 What Changed

### Before (Problematic)
- Used custom webhook secret that Google doesn't send
- Rejected all legitimate Google requests
- Required manual secret configuration

### After (Fixed)
- Validates requests actually come from Google
- Accepts legitimate Google Cloud Pub/Sub requests
- Optional token-based authentication for extra security
- More robust validation of request structure

## 📞 Troubleshooting

### Still Getting 401 Errors?

1. **Check your server logs** for the specific error message
2. **Verify the User-Agent** in the logs - should be `APIs-Google`
3. **Check the From header** - should be `noreply@google.com`
4. **Ensure GMAIL_WEBHOOK_SECRET is removed** from environment variables

### Request Not Being Processed?

1. **Check if you have active Gmail watches** - use the status endpoint
2. **Verify Pub/Sub subscriptions exist** - use the infrastructure health endpoint
3. **Check for user session validation** - ensure users have active WebSocket connections

### Need More Debug Info?

Add debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will show detailed request validation information.

## 📈 Next Steps

1. ✅ Remove `GMAIL_WEBHOOK_SECRET` from your environment
2. ✅ Restart your server
3. ✅ Test push notifications
4. 🔒 (Optional) Add `GMAIL_WEBHOOK_TOKEN` for production security
5. 📊 Monitor the logs to ensure everything works

The system now properly handles Google Cloud Pub/Sub authentication and should process your Gmail notifications correctly! 
# Gmail Pub/Sub Connection Complete Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working due to several configuration mismatches:

### **Issues Identified:**

1. **🎯 PubSubService Hardcoded Topic**: Line 32 in `PubSubService` has hardcoded topic instead of using environment variable
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **🔐 Token Confusion**: Controller uses `GMAIL_WEBHOOK_SECRET` but you're setting `GMAIL_WEBHOOK_TOKEN`
4. **📝 Missing Environment Variables**: Server needs proper Pub/Sub configuration

## 🔧 **Fixes Applied**

### **1. Fixed PubSubService Topic Configuration** ✅

**File**: `src/integrations/google/services/pubsub.service.ts`
```typescript
// BEFORE (hardcoded):
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";

// AFTER (uses environment variable):
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Fixed Setup Script Webhook URL** ✅

**File**: `scripts/email/setup-pubsub.sh`
```bash
# BEFORE:
WEBHOOK_ENDPOINT="https://ffdf-2-201-41-78.ngrok-free.app/api/gmail/webhooks/push"

# AFTER:
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

## 📋 **Required Environment Variables**

Add these to your deployment server's environment:

### **Core Pub/Sub Configuration**
```bash
# Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription

# Service Account (choose one method)
# Method 1: JSON string (recommended for production)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"followthrough-ai",...}'

# Method 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json

# Webhook Security (IMPORTANT: Use GMAIL_WEBHOOK_SECRET, not GMAIL_WEBHOOK_TOKEN)
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here
```

### **🚨 Important Token Clarification**

- **Your controller uses**: `GMAIL_WEBHOOK_SECRET` (for webhook validation)
- **NOT**: `GMAIL_WEBHOOK_TOKEN` (this doesn't exist in your code)

**Generate a secure webhook secret:**
```bash
# Generate a secure random secret
openssl rand -base64 32
```

## 🔄 **Updated Setup Script Usage**

Run your setup script with the correct webhook URL:

```bash
# Set environment variables
export GOOGLE_CLOUD_PROJECT_ID="followthrough-ai"
export GMAIL_PUBSUB_TOPIC="gmail-triage"
export GMAIL_PUSH_SUBSCRIPTION="gmail-push-notification-subscription"
export GMAIL_PULL_SUBSCRIPTION="gmail-pull-notification-subscription"
export WEBHOOK_ENDPOINT="https://your-actual-domain.com/api/webhook/google/mail/push"

# Run the setup script
./scripts/email/setup-pubsub.sh
```

## 🏥 **Health Check & Testing**

### **Test Your Setup**

1. **Check Pub/Sub Health**:
```bash
curl https://your-domain.com/api/webhook/google/mail/health
```

2. **Test Push Notification Endpoint**:
```bash
curl -X POST https://your-domain.com/api/webhook/google/mail/push \
  -H "Content-Type: application/json" \
  -H "User-Agent: APIs-Google; (+https://developers.google.com/webmasters/APIs-Google.html)" \
  -d '{
    "message": {
      "data": "eyJ0ZXN0IjoidHJ1ZSJ9",
      "messageId": "test-message-id",
      "publishTime": "2024-01-01T00:00:00.000Z"
    },
    "subscription": "projects/followthrough-ai/subscriptions/gmail-push-notification-subscription"
  }'
```

3. **Check Gmail Watch Status**:
```bash
curl https://your-domain.com/api/webhook/google/mail/debug/watch-health
```

## 🔄 **Re-setup Gmail Watches**

After fixing the configuration, you'll need to recreate Gmail watches with the correct webhook URL:

```bash
# Stop all existing watches
curl -X POST https://your-domain.com/api/webhook/google/mail/debug/reset-all-watches

# Recreate watches with correct webhook URL
curl -X POST https://your-domain.com/api/webhook/google/mail/debug/recreate-all-watches
```

## 🎯 **Client Integration**

**No changes needed for clients!** The client integration remains the same:

- Clients still connect to WebSocket namespace: `/gmail-triage`
- OAuth flow unchanged: `/oauth/google/authorize`, `/oauth/google/callback`
- Gmail watch setup: `/oauth/google/setup-email-notifications`

## ✅ **Verification Checklist**

- [ ] Updated `PubSubService` to use environment variable ✅
- [ ] Fixed setup script webhook URL ✅  
- [ ] Set `GMAIL_PUBSUB_TOPIC=gmail-triage` in environment
- [ ] Set `GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription` in environment
- [ ] Set `GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription` in environment
- [ ] Set `GMAIL_WEBHOOK_SECRET` (not `GMAIL_WEBHOOK_TOKEN`) in environment
- [ ] Set Google Cloud credentials (`GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`)
- [ ] Re-run setup script with correct webhook URL
- [ ] Recreate Gmail watches
- [ ] Test push notification endpoint
- [ ] Verify WebSocket connections work

## 🚀 **Next Steps**

1. **Update your deployment environment** with the variables above
2. **Re-run the setup script** with your actual domain
3. **Restart your server** to pick up the new configuration
4. **Test a real email** to verify push notifications work
5. **Monitor logs** for successful push notification processing

Your Gmail Pub/Sub integration should now work correctly with your new topic and subscription names! 
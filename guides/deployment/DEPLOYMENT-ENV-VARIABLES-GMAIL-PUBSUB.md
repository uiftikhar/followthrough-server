# Gmail Pub/Sub Deployment Environment Variables

## 🚀 **Copy these to your deployment server environment:**

```bash
# === GMAIL PUB/SUB CONFIGURATION ===

# Google Cloud Project


# Topic and Subscriptions (your new names)

# Webhook Security (CRITICAL: Use GMAIL_WEBHOOK_SECRET, not GMAIL_WEBHOOK_TOKEN)

# Google Service Account (CHOOSE ONE METHOD):

# METHOD 1: JSON String (Recommended for Production)
# Replace with your actual service account JSON (all on one line, escaped quotes)

# METHOD 2: File Path (For Development Only)
# GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

## ⚠️ **IMPORTANT CORRECTIONS:**

### **1. Token Name Fix**
- ❌ **WRONG**: `GMAIL_WEBHOOK_TOKEN` (doesn't exist in your code)
- ✅ **CORRECT**: `GMAIL_WEBHOOK_SECRET` (what your controller actually uses)

### **2. No Client Changes Needed**
- **Clients don't need the webhook secret**
- **Clients only need OAuth endpoints and WebSocket connection**
- **The webhook secret is only for Google → Server communication**

## 🔄 **After Setting Environment Variables:**

### **1. Re-run Setup Script**
```bash
# Set your actual domain
export WEBHOOK_ENDPOINT="https://your-actual-domain.com/api/webhook/google/mail/push"

# Run setup script
./scripts/email/setup-pubsub.sh
```

### **2. Restart Your Server**
```bash
# Restart to pick up new environment variables
pm2 restart your-app
# OR
docker restart your-container
# OR
systemctl restart your-service
```

### **3. Recreate Gmail Watches**
```bash
# Reset existing watches
curl -X POST https://your-domain.com/api/webhook/google/mail/debug/reset-all-watches

# Create new watches with correct webhook URL
curl -X POST https://your-domain.com/api/webhook/google/mail/debug/recreate-all-watches
```

### **4. Test Push Notifications**
```bash
# Test the webhook endpoint
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

## 📋 **Verification Steps:**

1. ✅ **Environment Variables Set**: All variables above added to deployment
2. ✅ **Server Restarted**: To pick up new configuration
3. ✅ **Setup Script Run**: With correct webhook URL
4. ✅ **Gmail Watches Recreated**: Using new webhook endpoint
5. ✅ **Push Notifications Test**: Webhook responds successfully
6. ✅ **Real Email Test**: Send yourself an email and verify triage triggers

## 🚨 **Common Issues & Solutions:**

### **Issue**: Still getting "Invalid namespace" WebSocket error
**Solution**: WebSocket namespace is `/gmail-triage` (already fixed in previous guides)

### **Issue**: Webhook returns 401 Unauthorized
**Solution**: Make sure `GMAIL_WEBHOOK_SECRET` is set correctly (not `GMAIL_WEBHOOK_TOKEN`)

### **Issue**: No push notifications received
**Solution**: 
1. Check webhook URL matches controller path: `/api/webhook/google/mail/push`
2. Verify Pub/Sub subscription points to correct webhook URL
3. Ensure Gmail watches are active with correct topic

### **Issue**: Topic not found errors
**Solution**: Make sure `GMAIL_PUBSUB_TOPIC=gmail-triage` is set in environment

Your Gmail Pub/Sub integration should now work perfectly! 🎉 
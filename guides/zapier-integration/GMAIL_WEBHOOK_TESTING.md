# 📧 Gmail Webhook Endpoints Testing Guide

This guide helps you test the newly created Gmail webhook subscription endpoints for Zapier integration.

## 🚀 Quick Start

### 1. Start Your Server
```bash
npm run start:dev
# or
yarn start:dev
```

### 2. Test the Endpoints

#### Option A: Using the Test Script
```bash
# Make the script executable
chmod +x test-gmail-webhook.js

# Run with default settings (localhost:3000)
node test-gmail-webhook.js

# Run with custom settings
API_URL=https://your-domain.com ZAPIER_API_KEY=your_real_api_key node test-gmail-webhook.js
```

#### Option B: Using cURL Commands

**Test Gmail Subscription:**
```bash
curl -X POST http://localhost:3000/api/zapier/webhooks/gmail/subscribe \
  -H "Content-Type: application/json" \
  -H "x-api-key: zapier_test_key_123456789" \
  -d '{
    "targetUrl": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
    "query": "is:unread to:support@company.com",
    "labelIds": ["INBOX", "UNREAD"],
    "userId": "test-user-123",
    "triggerType": "new_email"
  }'
```

**Test Gmail Unsubscription:**
```bash
curl -X POST http://localhost:3000/api/zapier/webhooks/gmail/unsubscribe \
  -H "Content-Type: application/json" \
  -H "x-api-key: zapier_test_key_123456789" \
  -d '{
    "id": "gmail-sub-1234567890",
    "userId": "test-user-123"
  }'
```

**Test Gmail Webhook Test:**
```bash
curl -X POST http://localhost:3000/api/zapier/webhooks/gmail/test \
  -H "Content-Type: application/json" \
  -H "x-api-key: zapier_test_key_123456789" \
  -d '{
    "test": true,
    "timestamp": "2024-01-15T10:30:00Z",
    "zapierWebhookId": "test-webhook-123"
  }'
```

## 📋 Available Endpoints

### 1. Gmail Subscription
- **URL:** `POST /api/zapier/webhooks/gmail/subscribe`
- **Purpose:** Subscribe to Gmail webhook notifications
- **Authentication:** Zapier API Key (x-api-key header)
- **Body:**
  ```json
  {
    "targetUrl": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
    "query": "is:unread to:support@company.com",
    "labelIds": ["INBOX", "UNREAD"],
    "userId": "test-user-123",
    "triggerType": "new_email"
  }
  ```

### 2. Gmail Unsubscription
- **URL:** `POST /api/zapier/webhooks/gmail/unsubscribe`
- **Purpose:** Unsubscribe from Gmail webhook notifications
- **Authentication:** Zapier API Key (x-api-key header)
- **Body:**
  ```json
  {
    "id": "gmail-sub-1234567890",
    "userId": "test-user-123"
  }
  ```

### 3. Gmail Webhook Test
- **URL:** `POST /api/zapier/webhooks/gmail/test`
- **Purpose:** Test Gmail webhook configuration
- **Authentication:** Zapier API Key (x-api-key header)
- **Body:** Any JSON object for testing

## 🔍 Expected Responses

### Successful Subscription Response:
```json
{
  "success": true,
  "message": "Gmail webhook subscription created successfully",
  "subscription": {
    "id": "gmail-sub-1704449400000",
    "targetUrl": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
    "query": "is:unread to:support@company.com",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Successful Unsubscription Response:
```json
{
  "success": true,
  "message": "Gmail webhook subscription removed successfully",
  "unsubscribed": {
    "id": "gmail-sub-1234567890",
    "userId": "test-user-123",
    "removedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

### Test Endpoint Response:
```json
{
  "success": true,
  "message": "Gmail webhook is configured correctly",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "testData": {
    "received": { "test": true, "timestamp": "2024-01-15T10:30:00Z" },
    "capabilities": [
      "gmail_subscription",
      "email_filtering", 
      "real_time_notifications",
      "webhook_forwarding"
    ],
    "endpoints": {
      "subscribe": "/api/zapier/webhooks/gmail/subscribe",
      "unsubscribe": "/api/zapier/webhooks/gmail/unsubscribe",
      "test": "/api/zapier/webhooks/gmail/test"
    }
  }
}
```

## 🐛 Troubleshooting

### Common Issues:

1. **401 Unauthorized**
   - Check that you're including the `x-api-key` header
   - Verify your API key is valid
   - Ensure the ZapierApiKeyGuard is properly configured

2. **400 Bad Request**
   - Verify your JSON payload is valid
   - Check that required fields are included
   - Ensure `targetUrl` is a valid URL

3. **500 Internal Server Error**
   - Check server logs for detailed error messages
   - Verify the server is running and accessible
   - Check that all dependencies are properly installed

### Debug Mode:
Enable detailed logging by checking your server console output. The endpoints log:
- 📧 Subscription details with emoji indicators
- 🗑️ Unsubscription confirmations
- 🧪 Test payload information

## 🔗 Integration with Zapier

Once these endpoints are working, your Zapier trigger will:

1. **Call the subscribe endpoint** when a user sets up a new Gmail trigger
2. **Receive webhook notifications** at the targetUrl when emails match the criteria
3. **Call the unsubscribe endpoint** when the user deletes or modifies the Zap

## 📝 Current Implementation Status

✅ **Implemented:**
- Gmail subscription endpoint with validation
- Gmail unsubscription endpoint with validation  
- Gmail test endpoint for debugging
- Proper error handling and logging
- DTO validation for request data

🚧 **TODO for Production:**
- Store subscriptions in database
- Set up actual Gmail push notifications
- Implement real email forwarding to targetUrl
- Add rate limiting and security measures
- Add subscription management UI

## 🎯 Next Steps

1. **Test the endpoints** using this guide
2. **Verify Zapier integration** works with your package
3. **Implement database storage** for subscriptions
4. **Set up Gmail push notifications** for real-time email processing
5. **Deploy to production** and test with real Zapier workflows

---

**Need help?** Check the server logs for detailed output and error messages. The endpoints provide comprehensive logging to help with debugging. 
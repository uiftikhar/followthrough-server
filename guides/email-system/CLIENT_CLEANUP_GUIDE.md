# Client Cleanup Guide - Fix Gmail Notification Issues

## 🚨 Problem: Orphaned Gmail Watches

**Symptoms you might see:**
- Gmail notifications stopped working
- Server logs show "orphaned watch" messages  
- WebSocket connections failing
- Email triage not triggering
- Old stale notifications still being received

**What happened:**
Your Gmail watch might be "orphaned" - meaning Google is still sending notifications to our server, but our database doesn't know about your watch anymore. This creates a mismatch.

## ✅ Solution: Client Self-Cleanup

We've created a simple endpoint that you can call to clean up your own notifications and start fresh.

### **Cleanup Endpoint**

```http
DELETE /gmail/client/cleanup-notifications
Authorization: Bearer YOUR_JWT_TOKEN
```

### **What This Does:**

1. **🛑 Stops Google Watch**: Tells Google to stop sending notifications for your account
2. **🧹 Cleans Database**: Removes any stale watch records from our database  
3. **🔌 Clears Sessions**: Cleans up any old WebSocket connections
4. **✅ Prepares Fresh Start**: Gets your account ready for new notification setup

### **How to Use:**

#### **Option 1: cURL Command**
```bash
curl -X DELETE "https://followthrough-server-production.up.railway.app/gmail/client/cleanup-notifications" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### **Option 2: JavaScript/TypeScript**
```javascript
const cleanupNotifications = async (authToken) => {
  try {
    const response = await fetch('/gmail/client/cleanup-notifications', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Cleanup successful:', result.message);
      console.log('Actions performed:', result.actions);
      return result;
    } else {
      console.error('❌ Cleanup failed:', result.message);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

// Usage
await cleanupNotifications('your-jwt-token');
```

#### **Option 3: Python**
```python
import requests

def cleanup_notifications(auth_token):
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.delete(
        'https://followthrough-server-production.up.railway.app/gmail/client/cleanup-notifications',
        headers=headers
    )
    
    result = response.json()
    
    if result.get('success'):
        print(f"✅ Cleanup successful: {result['message']}")
        print(f"Actions performed: {result['actions']}")
    else:
        print(f"❌ Cleanup failed: {result['message']}")
    
    return result

# Usage  
cleanup_notifications('your-jwt-token')
```

### **Expected Response:**

#### **Successful Cleanup:**
```json
{
  "success": true,
  "message": "Cleanup completed successfully - 4 actions performed",
  "userId": "67d589416cf318717e74dd55",
  "userEmail": "user@example.com",
  "actions": {
    "watchStopped": true,
    "databaseCleaned": true,
    "googleApiCalled": true,
    "sessionsCleared": true
  },
  "details": {
    "watchInfo": {
      "watchId": "110700",
      "googleEmail": "bund9876@gmail.com",
      "historyId": "110700",
      "isActive": true,
      "notificationsReceived": 15,
      "errorCount": 5
    },
    "errors": []
  },
  "nextSteps": {
    "recommendation": "You can now set up fresh notifications",
    "setupEndpoint": "POST /gmail/client/setup-notifications",
    "description": "This will create a new watch with current historyId, eliminating any stale data issues"
  }
}
```

#### **Partial Success (Some Errors):**
```json
{
  "success": true,
  "message": "Cleanup completed with 1 errors - 3 actions successful",
  "userId": "67d589416cf318717e74dd55",
  "userEmail": "user@example.com", 
  "actions": {
    "watchStopped": true,
    "databaseCleaned": true,
    "googleApiCalled": false,
    "sessionsCleared": true
  },
  "details": {
    "watchInfo": null,
    "errors": [
      "Google API stop failed: Watch not found"
    ]
  },
  "nextSteps": {
    "recommendation": "You can now set up fresh notifications",
    "setupEndpoint": "POST /gmail/client/setup-notifications",
    "description": "This will create a new watch with current historyId, eliminating any stale data issues"
  }
}
```

## 🔄 Complete Fresh Start Process

### **Step 1: Cleanup Old Notifications**
```bash
# Clean up any existing watches/notifications
curl -X DELETE "https://followthrough-server-production.up.railway.app/gmail/client/cleanup-notifications" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **Step 2: Set Up Fresh Notifications**
```bash
# Create new watch with current historyId
curl -X POST "https://followthrough-server-production.up.railway.app/gmail/client/setup-notifications" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### **Step 3: Verify Everything Works**
```bash
# Check status
curl -X GET "https://followthrough-server-production.up.railway.app/gmail/client/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test with an email (optional)
curl -X POST "https://followthrough-server-production.up.railway.app/gmail/client/test-triage" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test Email",
    "from": "test@example.com", 
    "body": "This is a test email to verify triage is working"
  }'
```

## 🎯 When to Use Cleanup

### **Definitely Use Cleanup If:**
- ✅ You're not receiving email notifications anymore
- ✅ Server logs show "orphaned watch" for your email
- ✅ Your WebSocket connections keep failing  
- ✅ Email triage stopped working suddenly
- ✅ You see account mismatches in status endpoint

### **Might Want to Use Cleanup If:**
- ⚠️ Notifications are slow or inconsistent
- ⚠️ You changed your Gmail account
- ⚠️ You're getting errors in email processing
- ⚠️ After server maintenance/updates

### **Don't Need Cleanup If:**
- ❌ Everything is working fine
- ❌ You just set up notifications recently
- ❌ Status endpoint shows everything healthy

## 🔧 Troubleshooting

### **If Cleanup Fails:**
1. Check your JWT token is valid and not expired
2. Make sure you're authenticated with the same Google account
3. Try again in a few minutes (rate limiting)
4. Contact support if errors persist

### **If Setup Fails After Cleanup:**
1. Make sure you completed the OAuth flow recently
2. Check that your Google account has Gmail access
3. Verify the OAuth scopes include Gmail permissions
4. Try the auth flow again: `GET /gmail/client/auth-url`

### **If You're Still Having Issues:**
1. Check the status endpoint for detailed error information
2. Look at the server logs for your specific email address
3. Try the health endpoint to see overall system status
4. Contact support with your userId and error details

## 📊 Monitoring After Cleanup

### **Check Your Status Regularly:**
```bash
# Quick health check
curl -X GET "https://followthrough-server-production.up.railway.app/gmail/client/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq '.gmail.watchActive'
```

### **What Good Status Looks Like:**
```json
{
  "gmail": {
    "authenticatedAs": "your-email@gmail.com",
    "monitoringAccount": "your-email@gmail.com", 
    "accountsMatch": true,
    "watchActive": true,
    "watchDetails": {
      "watchId": "12345678",
      "expiresAt": "2024-01-08T00:00:00.000Z",
      "notificationsReceived": 0,
      "emailsProcessed": 0,
      "errorCount": 0
    }
  }
}
```

## 🚀 Benefits of Cleanup + Fresh Setup

### **✅ Eliminates Orphaned Watches**
- No more "orphaned watch" error messages
- Stops Google from sending notifications to nowhere
- Cleans up database inconsistencies

### **✅ Fixes Stale HistoryId Issues**  
- New watch created with current Gmail historyId
- No more 404 errors from old history references
- Immediate processing of new emails

### **✅ Resolves WebSocket Problems**
- Clears old connection state
- Fresh WebSocket connections work properly
- Real-time notifications start working again

### **✅ Resets Error States**
- All error counters go back to zero
- Fresh start for reliability metrics
- Clean slate for monitoring

## 💡 Pro Tips

### **1. Use Cleanup Before Major Changes**
If you're changing Gmail accounts or updating permissions, run cleanup first.

### **2. Automate Status Monitoring**
Add a periodic check to your application to monitor watch health.

### **3. Handle Cleanup in Your Error Flow**
If your app detects notification issues, automatically suggest or trigger cleanup.

### **4. Document Your Integration**
Keep track of when you last ran cleanup and setup for debugging.

## 🔗 Related Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/gmail/client/cleanup-notifications` | DELETE | Clean up old watches |
| `/gmail/client/setup-notifications` | POST | Create fresh watch |
| `/gmail/client/status` | GET | Check current status |
| `/gmail/client/auth-url` | GET | Get OAuth URL |
| `/gmail/client/test-triage` | POST | Test email processing |

This cleanup process will resolve the orphaned watch issues you're seeing and get your Gmail notifications working properly again! 
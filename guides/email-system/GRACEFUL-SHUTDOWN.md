# 🛑 **Gmail Watch Graceful Shutdown Guide**

## **📖 Overview**

The Gmail Watch Graceful Shutdown feature automatically cleans up all active Gmail watches when the server shuts down, preventing orphaned watches that would continue sending notifications to a dead server.

---

## **⚙️ Configuration**

### **Environment Variable**

Add the following environment variable to enable graceful shutdown:

```bash
# Enable Gmail watch cleanup on server shutdown
GOOGLE_REMOVE_ACTIVE_WATCHERS=true
```

**Values:**
- `true`: Enable automatic cleanup of Gmail watches on shutdown
- `false` (default): Disable cleanup - watches will remain active

---

## **🔧 How It Works**

### **Automatic Shutdown Process**

1. **Trigger**: Server receives shutdown signal (SIGTERM, SIGINT, etc.)
2. **Detection**: `GmailShutdownService` detects the shutdown event
3. **Validation**: Checks if `GOOGLE_REMOVE_ACTIVE_WATCHERS=true`
4. **Cleanup**: Stops all active Gmail watches in parallel
5. **Timeout**: Process times out after 30 seconds to prevent hanging
6. **Logging**: Comprehensive logs of the cleanup process

### **What Gets Cleaned Up**

- All active Gmail watches registered in the database
- Google API watch subscriptions
- Database records are marked as inactive

---

## **📡 API Endpoints**

### **1. Check Shutdown Status**
```http
GET /api/gmail/watch/shutdown-status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "cleanupEnabled": true,
  "message": "Gmail watch cleanup on shutdown is ENABLED"
}
```

### **2. Manual Cleanup Trigger**
```http
POST /api/gmail/watch/shutdown-cleanup
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Manual shutdown cleanup completed. Stopped 3/3 watches.",
  "result": {
    "totalWatches": 3,
    "successfullyStopped": 3,
    "failed": 0,
    "errors": []
  }
}
```

---

## **📊 Logging Examples**

### **Startup Logs**
```
[GmailShutdownService] ✅ Gmail watch cleanup on shutdown is ENABLED
```

### **Shutdown Logs**
```
[GmailShutdownService] 🛑 Application shutting down (SIGTERM) - starting Gmail watch cleanup
[GmailShutdownService] 🧹 Starting graceful cleanup of Gmail watches...
[GmailWatchService] 📊 Found 3 active watches to stop during shutdown
[GmailWatchService] 🛑 Stopping watch for: user1@example.com (watch123)
[GmailWatchService] 🛑 Stopping watch for: user2@example.com (watch456)
[GmailWatchService] 🛑 Stopping watch for: user3@example.com (watch789)
[GmailWatchService] ✅ Successfully stopped watch for: user1@example.com
[GmailWatchService] ✅ Successfully stopped watch for: user2@example.com
[GmailWatchService] ✅ Successfully stopped watch for: user3@example.com
[GmailWatchService] 🎯 Graceful shutdown watch cleanup completed:
- Total watches: 3
- Successfully stopped: 3
- Failed: 0
- Errors: 0
[GmailShutdownService] 📊 Cleanup Summary:
- Total watches found: 3
- Successfully stopped: 3
- Failed to stop: 0
- Success rate: 100%
[GmailShutdownService] ✅ Gmail watch cleanup completed successfully
```

---

## **🚨 Error Handling**

### **Timeout Protection**
- Cleanup process has a 30-second timeout
- Server won't hang waiting for cleanup to complete
- Logs timeout events for debugging

### **Partial Failures**
- If some watches fail to stop, the process continues
- Failed attempts are logged with detailed error messages
- Success rate is calculated and reported

### **Authentication Issues**
- Expired OAuth tokens are handled gracefully
- Failed authentication doesn't prevent other watches from being stopped

---

## **🔄 Production Deployment**

### **1. Environment Setup**
```bash
# In production .env file
GOOGLE_REMOVE_ACTIVE_WATCHERS=true
```

### **2. Docker Configuration**
```dockerfile
# Ensure proper signal handling in Docker
STOPSIGNAL SIGTERM
```

### **3. Kubernetes Deployment**
```yaml
spec:
  terminationGracePeriodSeconds: 60  # Allow time for cleanup
  containers:
  - name: followthrough-server
    env:
    - name: GOOGLE_REMOVE_ACTIVE_WATCHERS
      value: "true"
```

### **4. Process Manager (PM2)**
```json
{
  "name": "followthrough-server",
  "script": "dist/main.js",
  "env": {
    "GOOGLE_REMOVE_ACTIVE_WATCHERS": "true"
  },
  "kill_timeout": 60000
}
```

---

## **🧪 Testing**

### **Manual Testing**
```bash
# 1. Start server with cleanup enabled
GOOGLE_REMOVE_ACTIVE_WATCHERS=true npm start

# 2. Create some Gmail watches via API
# 3. Stop server gracefully
kill -TERM <server_pid>

# 4. Check logs for cleanup process
```

### **API Testing**
```javascript
// Test manual cleanup
const response = await fetch('/api/gmail/watch/shutdown-cleanup', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

const result = await response.json();
console.log('Cleanup result:', result);
```

---

## **📈 Monitoring**

### **Key Metrics to Monitor**
- Cleanup success rate
- Number of watches cleaned per shutdown
- Cleanup duration
- Failed cleanup attempts

### **Alerts to Set Up**
- High cleanup failure rate (>10%)
- Cleanup timeouts
- Authentication failures during cleanup

---

## **🔒 Security Considerations**

### **Admin Access**
- Manual cleanup endpoints should be restricted to admin users
- Implement proper role-based access control
- Log all manual cleanup attempts

### **Token Security**
- Cleanup process uses existing encrypted OAuth tokens
- No additional credentials are stored or exposed
- Failed cleanups don't leak token information

---

## **🛠️ Troubleshooting**

### **Common Issues**

1. **Cleanup Not Running**
   - Check `GOOGLE_REMOVE_ACTIVE_WATCHERS=true` is set
   - Verify service is properly registered in module
   - Check startup logs for confirmation

2. **Cleanup Timeouts**
   - Increase timeout if needed (currently 30s)
   - Check network connectivity to Google APIs
   - Monitor OAuth token validity

3. **Partial Failures**
   - Review error logs for specific failure reasons
   - Check OAuth token expiration
   - Verify Google API quotas and limits

### **Debug Commands**
```bash
# Check current configuration
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/gmail/watch/shutdown-status

# Trigger manual cleanup for testing
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/gmail/watch/shutdown-cleanup
```

---

## **📋 Best Practices**

1. **Always enable in production** to prevent orphaned watches
2. **Monitor cleanup logs** to ensure proper functionality
3. **Test graceful shutdown** in staging environments
4. **Set appropriate timeouts** for your deployment environment
5. **Implement monitoring** for cleanup success rates

The graceful shutdown feature ensures your Gmail integration is clean and doesn't leave orphaned resources when the server stops. 
# Gmail Watch Commands Quick Reference

## 🚨 Nuclear Reset Commands (Production)

### Quick Health Check
```bash
curl -X GET "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watch-health" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.overallHealth'
```

### List All Watches
```bash
curl -X GET "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watches" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.totalWatches'
```

### 🚨 NUCLEAR RESET (Delete All Watches)
```bash
curl -X POST "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/reset-all-watches" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 🎯 Targeted Orphaned Watch Cleanup
```bash
# For specific orphaned watch (like bund9876@gmail.com issue)
curl -X POST "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/force-stop-orphaned/EMAIL_ADDRESS" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"

# Example for current orphaned watch:
curl -X POST "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/force-stop-orphaned/bund9876@gmail.com" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Verify Cleanup
```bash
curl -X GET "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watches" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.totalWatches'
```

## 🔧 Automated Script (Recommended)

### Run Full Fresh Start Process
```bash
# Production (⚠️ CAUTION)
JWT_TOKEN=$ADMIN_JWT ./scripts/fresh-start-watches.sh production

# Local testing
JWT_TOKEN=$ADMIN_JWT ./scripts/fresh-start-watches.sh local
```

## 👤 User Recreation Commands

### Option 1: Client Cleanup + Setup (Recommended)
```bash
# Step 1: Clean up orphaned watches
curl -X DELETE "https://followthrough-server-production.up.railway.app/gmail/client/cleanup-notifications" \
  -H "Authorization: Bearer $USER_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Step 2: Set up fresh notifications  
curl -X POST "https://followthrough-server-production.up.railway.app/gmail/client/setup-notifications" \
  -H "Authorization: Bearer $USER_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Option 2: Direct Watch Creation
```bash
curl -X POST "https://followthrough-server-production.up.railway.app/api/gmail/watch" \
  -H "Authorization: Bearer $USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"labelIds": ["INBOX"], "labelFilterBehavior": "INCLUDE"}'
```

## 📊 Monitoring Commands

### Daily Health Check (for cron)
```bash
0 9 * * * JWT_TOKEN=$ADMIN_JWT curl -s 'https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watch-health' | jq '.overallHealth.status'
```

### Check for Issues
```bash
# Check for stale watches
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
  "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watch-health" | \
  jq '.healthStats.staleWatches'

# Check for error watches  
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
  "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watch-health" | \
  jq '.healthStats.watchesWithErrors'
```

## 🔍 Debug Commands

### Debug Specific User
```bash
curl -X GET "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/debug/bund9876@gmail.com" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Force Refresh User
```bash
curl -X POST "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/force-refresh/bund9876@gmail.com" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## 🚦 Response Status Indicators

### Healthy System
```json
{
  "overallHealth": {
    "status": "healthy",
    "healthPercentage": 100
  },
  "healthStats": {
    "totalWatches": 2,
    "staleWatches": 0,
    "watchesWithErrors": 0,
    "healthyWatches": 2
  }
}
```

### Problematic System (Needs Reset)
```json
{
  "overallHealth": {
    "status": "critical",
    "healthPercentage": 25
  },
  "healthStats": {
    "totalWatches": 4,
    "staleWatches": 2,
    "watchesWithErrors": 3,
    "healthyWatches": 1
  }
}
```

### After Successful Reset
```json
{
  "totalWatches": 0,
  "message": "Found 0 active watches"
}
```

## ⚡ One-Liner Emergency Reset

```bash
# Complete emergency reset (use with extreme caution)
JWT_TOKEN=$ADMIN_JWT && \
echo "🔍 Checking health..." && \
curl -s -H "Authorization: Bearer $JWT_TOKEN" "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watch-health" | jq '.overallHealth' && \
echo "🚨 Performing nuclear reset..." && \
curl -s -X POST -H "Authorization: Bearer $JWT_TOKEN" "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/reset-all-watches" | jq '.message' && \
echo "✅ Verifying cleanup..." && \
curl -s -H "Authorization: Bearer $JWT_TOKEN" "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watches" | jq '.totalWatches'
```

## 🛡️ Safety Checklist

Before nuclear reset:
- [ ] Backup current watch configurations
- [ ] Notify team about planned reset
- [ ] Prepare user communication
- [ ] Have rollback plan ready
- [ ] Test in staging first

After nuclear reset:
- [ ] Verify all watches deleted (`totalWatches: 0`)
- [ ] Guide users to recreate watches
- [ ] Monitor health for next 24 hours
- [ ] Check WebSocket connections working
- [ ] Verify email processing restored

## 🔗 Related Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/gmail/webhooks/admin/watch-health` | GET | System health check |
| `/api/gmail/webhooks/admin/watches` | GET | List all watches |
| `/api/gmail/webhooks/admin/reset-all-watches` | POST | Nuclear reset |
| `/api/gmail/watch` | POST | User creates watch |
| `/gmail/client/setup-notifications` | POST | User setup (recommended) |

## 📞 Emergency Contacts

If issues persist after fresh start:
1. Check server logs for authentication errors
2. Verify Google Cloud Pub/Sub configuration
3. Confirm WebSocket connections are working
4. Test with single user recreation first

Remember: Fresh start eliminates stale historyId issues but requires user re-onboarding! 
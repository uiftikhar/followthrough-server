#!/bin/bash

# Fix Gmail Push Notifications Script
# Diagnoses and fixes Gmail → Google Pub/Sub → WebSocket pipeline

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-"followthrough-ai"}
TOPIC_NAME="gmail-notifications"
PUSH_SUBSCRIPTION_NAME="gmail-push-notification-subscription"
WEBHOOK_ENDPOINT="https://ffdf-2-201-41-78.ngrok-free.app/api/gmail/webhooks/push"

echo -e "${BLUE}🔧 GMAIL PUSH NOTIFICATIONS FIX${NC}"
echo "====================================="
echo ""

# Step 1: Check current configuration
echo -e "${BLUE}1. 📋 Checking current configuration...${NC}"
echo "Project: $PROJECT_ID"
echo "Topic: $TOPIC_NAME"
echo "Push Subscription: $PUSH_SUBSCRIPTION_NAME"
echo "Webhook: $WEBHOOK_ENDPOINT"
echo ""

# Step 2: Check topic permissions
echo -e "${BLUE}2. 🔐 Checking Gmail API permissions on topic...${NC}"
echo "Current IAM policy for topic:"
gcloud pubsub topics get-iam-policy $TOPIC_NAME

echo ""
echo "Checking if gmail-api-push@system.gserviceaccount.com has publish permission..."
GMAIL_HAS_PERMISSION=$(gcloud pubsub topics get-iam-policy $TOPIC_NAME --format="value(bindings[].members)" | grep -c "gmail-api-push@system.gserviceaccount.com" || echo "0")

if [ "$GMAIL_HAS_PERMISSION" -eq "0" ]; then
    echo -e "${YELLOW}⚠️  Gmail API push service account does NOT have publish permission${NC}"
    echo "Adding permission..."
    gcloud pubsub topics add-iam-policy-binding $TOPIC_NAME \
        --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
        --role=roles/pubsub.publisher
    echo -e "${GREEN}✅ Permission added${NC}"
else
    echo -e "${GREEN}✅ Gmail API has publish permission${NC}"
fi

echo ""

# Step 3: Check push subscription endpoint
echo -e "${BLUE}3. 🔔 Checking push subscription configuration...${NC}"
CURRENT_ENDPOINT=$(gcloud pubsub subscriptions describe $PUSH_SUBSCRIPTION_NAME --format="value(pushConfig.pushEndpoint)" 2>/dev/null || echo "")

if [ "$CURRENT_ENDPOINT" = "$WEBHOOK_ENDPOINT" ]; then
    echo -e "${GREEN}✅ Push subscription endpoint is correct: $CURRENT_ENDPOINT${NC}"
else
    echo -e "${YELLOW}⚠️  Push subscription endpoint mismatch${NC}"
    echo "Expected: $WEBHOOK_ENDPOINT"
    echo "Actual: $CURRENT_ENDPOINT"
    echo "Updating subscription..."
    
    gcloud pubsub subscriptions modify-push-config $PUSH_SUBSCRIPTION_NAME \
        --push-endpoint=$WEBHOOK_ENDPOINT
    echo -e "${GREEN}✅ Push subscription endpoint updated${NC}"
fi

echo ""

# Step 4: Test webhook endpoint
echo -e "${BLUE}4. 🧪 Testing webhook endpoint accessibility...${NC}"
TEST_PAYLOAD='{"message":{"data":"eyJlbWFpbEFkZHJlc3MiOiJ1bWVyMjI5QGdtYWlsLmNvbSIsImhpc3RvcnlJZCI6Ijk5OTk5OTk5In0=","messageId":"test-fix","publishTime":"2025-06-01T10:00:00.000Z"},"subscription":"test-subscription"}'

echo "Testing webhook endpoint: $WEBHOOK_ENDPOINT"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "ngrok-skip-browser-warning: any-value" \
    -d "$TEST_PAYLOAD" || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✅ Webhook endpoint is accessible (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Webhook endpoint test failed (HTTP $HTTP_CODE)${NC}"
    echo "Check if your server is running and ngrok tunnel is active"
fi

echo ""

# Step 5: Test complete pipeline
echo -e "${BLUE}5. 📡 Testing complete push notification pipeline...${NC}"
echo "Publishing test message to trigger push notification..."

TEST_MESSAGE='{"emailAddress":"umer229@gmail.com","historyId":"'$(date +%s)'"}'
MESSAGE_ID=$(gcloud pubsub topics publish $TOPIC_NAME --message="$TEST_MESSAGE" --format="value(messageIds[0])")

echo "✅ Test message published with ID: $MESSAGE_ID"
echo "⏱️  Waiting 5 seconds for push delivery..."
sleep 5

echo ""

# Step 6: Check notification statistics
echo -e "${BLUE}6. 📊 Checking notification statistics...${NC}"
STATS=$(curl -s "$WEBHOOK_ENDPOINT/../health" -H "ngrok-skip-browser-warning: any-value" || echo '{"error":"failed"}')
echo "Current webhook health:"
echo "$STATS" | jq . 2>/dev/null || echo "$STATS"

echo ""

# Step 7: Recommendations
echo -e "${BLUE}7. 💡 Recommendations:${NC}"
echo ""

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
    echo -e "${YELLOW}⚠️  WEBHOOK ENDPOINT ISSUE:${NC}"
    echo "   • Ensure your server is running"
    echo "   • Verify ngrok tunnel is active"
    echo "   • Check firewall settings"
    echo ""
fi

echo -e "${GREEN}✅ NEXT STEPS:${NC}"
echo "   1. Monitor server logs for push notification webhook calls"
echo "   2. Check if Gmail watch needs to be recreated:"
echo "      curl -X POST 'https://ffdf-2-201-41-78.ngrok-free.app/gmail/client/setup-gmail-notifications' \\"
echo "           -H 'Authorization: Bearer YOUR_JWT_TOKEN'"
echo "   3. Test with real email by sending to umer229@gmail.com"
echo "   4. Monitor WebSocket connection for email.received events"
echo ""

echo -e "${BLUE}🔍 DEBUGGING COMMANDS:${NC}"
echo "   • Check subscription health: gcloud pubsub subscriptions describe $PUSH_SUBSCRIPTION_NAME"
echo "   • Monitor topic: gcloud pubsub subscriptions pull $PULL_SUBSCRIPTION_NAME --auto-ack --limit=5"
echo "   • View delivery attempts: gcloud logging read 'resource.type=\"pubsub_subscription\"'"
echo ""

echo -e "${GREEN}🎉 Push notification fix script completed!${NC}"
echo "Monitor your server logs and test by sending an email to see if automatic notifications work." 
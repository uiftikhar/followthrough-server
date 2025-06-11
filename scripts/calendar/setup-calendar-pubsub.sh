#!/bin/bash

# Google Calendar Push Notifications - Pub/Sub Setup Script
# This script sets up the Google Cloud Pub/Sub infrastructure for Google Calendar push notifications

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-""}
TOPIC_NAME=${CALENDAR_PUBSUB_TOPIC:-"calendar-notifications"}
PUSH_SUBSCRIPTION_NAME=${CALENDAR_PUSH_SUBSCRIPTION:-"calendar-push-notification-subscription"}
PULL_SUBSCRIPTION_NAME=${CALENDAR_PULL_SUBSCRIPTION:-"calendar-pull-notification-subscription"}
WEBHOOK_ENDPOINT=${WEBHOOK_ENDPOINT:-"https://your-domain.com/webhook/calendar/google"}

echo -e "${BLUE}🗓️ Google Calendar Push Notifications - Pub/Sub Setup${NC}"
echo "======================================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI is not installed${NC}"
    echo "Please install gcloud CLI: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if project ID is set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  Project ID not set. Please provide it:${NC}"
    read -p "Enter your Google Cloud Project ID: " PROJECT_ID
    
    if [ -z "$PROJECT_ID" ]; then
        echo -e "${RED}❌ Error: Project ID is required${NC}"
        exit 1
    fi
fi

# Set the project
echo -e "${BLUE}📋 Setting Google Cloud project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Check if webhook endpoint is set
if [[ "$WEBHOOK_ENDPOINT" == "https://your-domain.com/webhook/calendar/google" ]]; then
    echo -e "${YELLOW}⚠️  Default webhook endpoint detected. Please provide your actual endpoint:${NC}"
    read -p "Enter your webhook endpoint URL (https required): " WEBHOOK_ENDPOINT
    
    if [ -z "$WEBHOOK_ENDPOINT" ]; then
        echo -e "${RED}❌ Error: Webhook endpoint is required${NC}"
        exit 1
    fi
    
    # Validate HTTPS
    if [[ ! "$WEBHOOK_ENDPOINT" =~ ^https:// ]]; then
        echo -e "${RED}❌ Error: Webhook endpoint must use HTTPS (Google Calendar requirement)${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}🔧 Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Topic: $TOPIC_NAME"
echo "  Push Subscription: $PUSH_SUBSCRIPTION_NAME"
echo "  Pull Subscription: $PULL_SUBSCRIPTION_NAME"
echo "  Webhook Endpoint: $WEBHOOK_ENDPOINT"
echo ""

# Enable required APIs
echo -e "${BLUE}🔌 Enabling required APIs...${NC}"
gcloud services enable pubsub.googleapis.com
gcloud services enable calendar-json.googleapis.com
echo -e "${GREEN}✅ APIs enabled${NC}"

# Create Pub/Sub topic
echo -e "${BLUE}📢 Creating Pub/Sub topic: $TOPIC_NAME${NC}"
if gcloud pubsub topics describe $TOPIC_NAME &> /dev/null; then
    echo -e "${YELLOW}⚠️  Topic $TOPIC_NAME already exists${NC}"
else
    gcloud pubsub topics create $TOPIC_NAME \
        --message-retention-duration=7d
    echo -e "${GREEN}✅ Topic created: $TOPIC_NAME${NC}"
fi

# Create push subscription
echo -e "${BLUE}🔔 Creating push subscription: $PUSH_SUBSCRIPTION_NAME${NC}"
if gcloud pubsub subscriptions describe $PUSH_SUBSCRIPTION_NAME &> /dev/null; then
    echo -e "${YELLOW}⚠️  Push subscription $PUSH_SUBSCRIPTION_NAME already exists${NC}"
else
    gcloud pubsub subscriptions create $PUSH_SUBSCRIPTION_NAME \
        --topic=$TOPIC_NAME \
        --push-endpoint=$WEBHOOK_ENDPOINT \
        --ack-deadline=60 \
        --message-retention-duration=7d \
        --min-retry-delay=10s \
        --max-retry-delay=600s
    echo -e "${GREEN}✅ Push subscription created: $PUSH_SUBSCRIPTION_NAME${NC}"
fi

# Create pull subscription (backup)
echo -e "${BLUE}📥 Creating pull subscription: $PULL_SUBSCRIPTION_NAME${NC}"
if gcloud pubsub subscriptions describe $PULL_SUBSCRIPTION_NAME &> /dev/null; then
    echo -e "${YELLOW}⚠️  Pull subscription $PULL_SUBSCRIPTION_NAME already exists${NC}"
else
    gcloud pubsub subscriptions create $PULL_SUBSCRIPTION_NAME \
        --topic=$TOPIC_NAME \
        --ack-deadline=60 \
        --message-retention-duration=7d
    echo -e "${GREEN}✅ Pull subscription created: $PULL_SUBSCRIPTION_NAME${NC}"
fi

# Create service account for application
SERVICE_ACCOUNT_NAME="calendar-push-notifications"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo -e "${BLUE}👤 Creating service account: $SERVICE_ACCOUNT_NAME${NC}"
if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL &> /dev/null; then
    echo -e "${YELLOW}⚠️  Service account $SERVICE_ACCOUNT_NAME already exists${NC}"
else
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="Calendar Push Notifications Service Account" \
        --description="Service account for Google Calendar push notifications via Pub/Sub"
    echo -e "${GREEN}✅ Service account created: $SERVICE_ACCOUNT_EMAIL${NC}"
fi

# Grant necessary roles to service account
echo -e "${BLUE}🔑 Granting roles to service account...${NC}"
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL \
    --role=roles/pubsub.subscriber

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL \
    --role=roles/pubsub.viewer

# Note: Calendar access is handled via OAuth scopes, not IAM roles
echo -e "${GREEN}✅ Roles granted to service account${NC}"
echo -e "${BLUE}ℹ️  Note: Calendar API access is managed through OAuth scopes, not IAM roles${NC}"

# Generate service account key
KEY_FILE="./config/calendar-push-service-account.json"
echo -e "${BLUE}🔑 Generating service account key...${NC}"

# Create config directory if it doesn't exist
mkdir -p ./config

if [ -f "$KEY_FILE" ]; then
    echo -e "${YELLOW}⚠️  Service account key file already exists: $KEY_FILE${NC}"
    read -p "Do you want to regenerate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm "$KEY_FILE"
    else
        echo -e "${BLUE}ℹ️  Skipping key generation${NC}"
        KEY_FILE=""
    fi
fi

if [ -n "$KEY_FILE" ]; then
    gcloud iam service-accounts keys create $KEY_FILE \
        --iam-account=$SERVICE_ACCOUNT_EMAIL
    echo -e "${GREEN}✅ Service account key saved to: $KEY_FILE${NC}"
    echo -e "${YELLOW}⚠️  Keep this key file secure and add it to your .gitignore${NC}"
fi

# Test the setup
echo -e "${BLUE}🧪 Testing Pub/Sub setup...${NC}"
TEST_MESSAGE='{"test": "Calendar push notification setup test", "kind": "api#channel"}'
gcloud pubsub topics publish $TOPIC_NAME --message="$TEST_MESSAGE"
echo -e "${GREEN}✅ Test message published to topic${NC}"

# Domain verification check
echo -e "${BLUE}🌐 Domain Verification Check${NC}"
DOMAIN=$(echo $WEBHOOK_ENDPOINT | sed -e 's|^[^/]*//||' -e 's|/.*||')
echo "  Your webhook domain: $DOMAIN"
echo "  ⚠️  Make sure this domain is verified in Google Cloud Console:"
echo "     1. Go to https://console.cloud.google.com"
echo "     2. Navigate to APIs & Services > Domain verification"
echo "     3. Add and verify your domain: $DOMAIN"

# Display summary
echo ""
echo -e "${GREEN}🎉 Google Calendar Push Notifications Pub/Sub Setup Complete!${NC}"
echo "============================================================="
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "  ✅ Topic created: $TOPIC_NAME"
echo "  ✅ Push subscription: $PUSH_SUBSCRIPTION_NAME"
echo "  ✅ Pull subscription: $PULL_SUBSCRIPTION_NAME"
echo "  ✅ Service account: $SERVICE_ACCOUNT_EMAIL"
if [ -n "$KEY_FILE" ]; then
    echo "  ✅ Service account key: $KEY_FILE"
fi
echo ""
echo -e "${BLUE}🔧 Next Steps:${NC}"
echo "  1. Add the service account key to your environment variables"
echo "  2. Update your .env file with the following:"
echo ""
echo "     GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID"
echo "     CALENDAR_PUBSUB_TOPIC=$TOPIC_NAME"
echo "     CALENDAR_PUSH_SUBSCRIPTION=$PUSH_SUBSCRIPTION_NAME"
echo "     CALENDAR_PULL_SUBSCRIPTION=$PULL_SUBSCRIPTION_NAME"
echo "     GOOGLE_APPLICATION_CREDENTIALS=./config/calendar-push-service-account.json"
echo "     BASE_URL=${WEBHOOK_ENDPOINT%/webhook/calendar/google}"
echo ""
echo "  3. Verify your domain in Google Cloud Console (required for webhooks)"
echo "  4. Implement SSL certificate (HTTPS required)"
echo "  5. Test the webhook endpoint with: POST /calendar/notifications/setup"
echo ""
echo -e "${YELLOW}⚠️  Important Security Notes:${NC}"
echo "  - Add config/calendar-push-service-account.json to .gitignore"
echo "  - Store the service account key securely in production"
echo "  - Use environment variables for sensitive configuration"
echo "  - Implement proper webhook authentication"
echo "  - HTTPS is required for Google Calendar webhooks"
echo ""
echo -e "${GREEN}Setup completed successfully! 🚀${NC}" 
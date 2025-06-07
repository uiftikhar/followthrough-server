 #!/bin/bash

# Gmail Watch Fresh Start Script
# This script performs a nuclear reset of all Gmail watches and provides guidance for recreation
# 
# Usage: ./scripts/fresh-start-watches.sh [ENVIRONMENT]
# Environment: production, staging, or local (default: local)

set -e

# Configuration
ENVIRONMENT=${1:-local}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Environment-specific configuration
case $ENVIRONMENT in
  production)
    BASE_URL="https://followthrough-server-production.up.railway.app"
    echo -e "${RED}⚠️  PRODUCTION ENVIRONMENT - PROCEED WITH EXTREME CAUTION${NC}"
    ;;
  staging)
    BASE_URL="https://followthrough-server-staging.up.railway.app"
    echo -e "${YELLOW}📍 STAGING ENVIRONMENT${NC}"
    ;;
  local)
    BASE_URL="http://localhost:3000"
    echo -e "${BLUE}🏠 LOCAL ENVIRONMENT${NC}"
    ;;
  *)
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    echo "Usage: $0 [production|staging|local]"
    exit 1
    ;;
esac

echo -e "${PURPLE}🚀 Gmail Watch Fresh Start Process${NC}"
echo -e "Environment: ${BLUE}$ENVIRONMENT${NC}"
echo -e "Base URL: ${BLUE}$BASE_URL${NC}"
echo ""

# Check if JWT_TOKEN is provided
if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}❌ JWT_TOKEN environment variable is required${NC}"
  echo "Usage: JWT_TOKEN=your_token $0 [environment]"
  exit 1
fi

# Function to make API calls with proper error handling
api_call() {
  local method=$1
  local endpoint=$2
  local data=${3:-""}
  local description=$4

  echo -e "${BLUE}📡 $description${NC}"
  
  if [ -n "$data" ]; then
    response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -w "\nHTTP_STATUS:%{http_code}")
  else
    response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -w "\nHTTP_STATUS:%{http_code}")
  fi

  # Extract HTTP status and response body
  http_status=$(echo "$response" | tail -n1 | cut -d':' -f2)
  response_body=$(echo "$response" | sed '$d')

  if [ "$http_status" -eq 200 ] || [ "$http_status" -eq 201 ]; then
    echo -e "${GREEN}✅ Success (HTTP $http_status)${NC}"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
    return 0
  else
    echo -e "${RED}❌ Failed (HTTP $http_status)${NC}"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
    return 1
  fi
}

# Function to wait for user confirmation
confirm_action() {
  local message=$1
  echo -e "${YELLOW}⚠️  $message${NC}"
  read -p "Do you want to continue? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Operation cancelled by user${NC}"
    exit 1
  fi
}

# Function to parse and display watch health
parse_health_response() {
  local response=$1
  
  # Extract key metrics using jq
  if command -v jq >/dev/null 2>&1; then
    total_watches=$(echo "$response" | jq -r '.healthStats.totalWatches // 0')
    stale_watches=$(echo "$response" | jq -r '.healthStats.staleWatches // 0')
    watches_with_errors=$(echo "$response" | jq -r '.healthStats.watchesWithErrors // 0')
    expired_watches=$(echo "$response" | jq -r '.healthStats.expiredWatches // 0')
    health_status=$(echo "$response" | jq -r '.overallHealth.status // "unknown"')
    
    echo -e "${BLUE}📊 Watch Health Summary:${NC}"
    echo -e "  Total Watches: $total_watches"
    echo -e "  Stale Watches: $stale_watches"
    echo -e "  Watches with Errors: $watches_with_errors"
    echo -e "  Expired Watches: $expired_watches"
    echo -e "  Overall Health: $health_status"
    
    # Return codes for decision making
    if [ "$stale_watches" -gt 0 ] || [ "$watches_with_errors" -gt 0 ] || [ "$expired_watches" -gt 0 ]; then
      return 1  # Issues found
    else
      return 0  # Healthy
    fi
  else
    echo -e "${YELLOW}⚠️  jq not installed - showing raw response${NC}"
    echo "$response"
    return 1  # Assume issues if we can't parse
  fi
}

echo -e "${PURPLE}=== STEP 1: HEALTH CHECK ===${NC}"
echo ""

if ! api_call "GET" "/api/gmail/webhooks/admin/watch-health" "" "Checking current watch health"; then
  echo -e "${RED}❌ Health check failed${NC}"
  exit 1
fi

echo ""
echo -e "${PURPLE}=== STEP 2: PRE-RESET ANALYSIS ===${NC}"
echo ""

# Store the health response for analysis
health_response=$(curl -s -X "GET" "$BASE_URL/api/gmail/webhooks/admin/watch-health" \
  -H "Authorization: Bearer $JWT_TOKEN")

if parse_health_response "$health_response"; then
  echo -e "${GREEN}✅ System appears healthy - fresh start may not be necessary${NC}"
  confirm_action "Are you sure you want to proceed with nuclear reset of healthy watches?"
else
  echo -e "${RED}⚠️  Issues detected - fresh start recommended${NC}"
fi

echo ""
echo -e "${PURPLE}=== STEP 3: NUCLEAR RESET ===${NC}"
echo ""

confirm_action "This will DELETE ALL Gmail watches for ALL users. This action cannot be undone!"

if ! api_call "POST" "/api/gmail/webhooks/admin/reset-all-watches" "" "Performing nuclear reset of all watches"; then
  echo -e "${RED}❌ Nuclear reset failed${NC}"
  exit 1
fi

echo ""
echo -e "${PURPLE}=== STEP 4: VERIFY CLEANUP ===${NC}"
echo ""

sleep 2  # Give the system a moment to process

if ! api_call "GET" "/api/gmail/webhooks/admin/watches" "" "Verifying all watches are removed"; then
  echo -e "${RED}❌ Cleanup verification failed${NC}"
  exit 1
fi

echo ""
echo -e "${PURPLE}=== STEP 5: RECREATION INSTRUCTIONS ===${NC}"
echo ""

if ! api_call "POST" "/api/gmail/webhooks/admin/recreate-all-watches" "" "Getting recreation instructions"; then
  echo -e "${YELLOW}⚠️  Could not get recreation instructions, but reset was successful${NC}"
fi

echo ""
echo -e "${GREEN}🎉 FRESH START COMPLETED SUCCESSFULLY!${NC}"
echo ""
echo -e "${BLUE}📋 NEXT STEPS:${NC}"
echo "1. 📧 Notify users that their Gmail notifications have been reset"
echo "2. 🔧 Users need to recreate their watches using one of these methods:"
echo "   • ${YELLOW}POST $BASE_URL/api/gmail/watch${NC} (with user JWT token)"
echo "   • ${YELLOW}POST $BASE_URL/gmail/client/setup-notifications${NC} (with user JWT token)"
echo "3. 📊 Monitor the health endpoint for the next 24 hours:"
echo "   • ${YELLOW}GET $BASE_URL/api/gmail/webhooks/admin/watch-health${NC}"
echo "4. ✅ Verify users can receive email notifications"
echo ""
echo -e "${GREEN}Benefits achieved:${NC}"
echo "• ✅ Eliminated all stale historyId issues"
echo "• ✅ Cleaned up orphaned watches"
echo "• ✅ Reset all error counters"
echo "• ✅ Synchronized expiration times"
echo ""
echo -e "${BLUE}💡 Monitoring recommendation:${NC}"
echo "Set up a daily cron job to monitor watch health:"
echo "0 9 * * * JWT_TOKEN=\$ADMIN_JWT curl -s '$BASE_URL/api/gmail/webhooks/admin/watch-health' | jq '.overallHealth.status'"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
  echo -e "${RED}🚨 PRODUCTION REMINDER:${NC}"
  echo "• Update your team about the reset"
  echo "• Monitor user support channels for questions"
  echo "• Document this operation in your incident log"
  echo "• Consider sending user communication about the improvement"
fi

echo -e "${GREEN}Fresh start process completed! 🚀${NC}"
#!/bin/bash

# Gmail Orphaned Watches Cleanup Script
# This script helps identify and clean up orphaned Gmail watches

echo "🧹 Gmail Orphaned Watches Cleanup Script"
echo "========================================="
echo

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Make sure you're in the project root directory."
    exit 1
fi

# Source environment variables
set -a
source .env
set +a

# API endpoint base URL
API_BASE="${WEBHOOK_BASE_URL:-https://followthrough-server-production.up.railway.app}"

# Default JWT token (provided by user)
DEFAULT_JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ODQzZGFjMTgyYmExNWVkMTFmZjljMmYiLCJlbWFpbCI6ImJ1bmQ5ODc2QGdtYWlsLmNvbSIsImlhdCI6MTc0OTI3OTI1NSwiZXhwIjoxNzQ5MzY1NjU1fQ.2RfX7PzvUE0-gofDfv4X37cXKoaP2Js7LxXvA_XehSE"

echo "🔍 Checking for orphaned Gmail watches..."
echo "API Base URL: $API_BASE"
echo "🔑 Using provided JWT token for authentication"
echo

# Function to check API endpoint
check_api() {
    local endpoint="$1"
    local description="$2"
    
    echo "📡 $description"
    echo "   GET $API_BASE$endpoint"
    
    if command -v curl &> /dev/null; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE$endpoint")
        if [ "$response" -eq 200 ]; then
            echo "   ✅ API accessible"
        else
            echo "   ❌ API returned status: $response"
        fi
    else
        echo "   ⚠️  curl not available - please check API manually"
    fi
    echo
}

# Check if server is running
check_api "/api/gmail/webhooks/health" "Checking webhook health"

echo "🔧 Available Cleanup Options:"
echo "============================="
echo

echo "1. 📊 Check webhook health and watch statistics"
echo "   curl $API_BASE/api/gmail/webhooks/health"
echo

echo "2. 🧹 Force cleanup inactive sessions (with auth token)"
echo "   curl -X POST $API_BASE/api/gmail/watch/cleanup \\"
echo "        -H \"Authorization: Bearer \$JWT_TOKEN\""
echo

echo "3. 🛑 Stop all active Gmail watches (with auth token)"
echo "   curl -X POST $API_BASE/api/gmail/watch/shutdown-cleanup \\"
echo "        -H \"Authorization: Bearer \$JWT_TOKEN\""
echo

echo "4. 🔍 Debug active watches in database (with auth token)"
echo "   curl $API_BASE/api/gmail/debug/active-watches \\"
echo "        -H \"Authorization: Bearer \$JWT_TOKEN\""
echo

echo "5. ⚡ Force stop ALL watches (DANGEROUS - with auth token)"
echo "   curl -X POST $API_BASE/api/gmail/debug/force-stop-all \\"
echo "        -H \"Authorization: Bearer \$JWT_TOKEN\""
echo

echo "📝 Manual Steps to Clean Orphaned Watches:"
echo "=========================================="
echo

echo "Step 1: Enable Google Cloud Console cleanup"
echo "   1. Go to Google Cloud Console"
echo "   2. Navigate to Pub/Sub > Subscriptions"
echo "   3. Find subscriptions matching your project:"
echo "      - $GMAIL_PUSH_SUBSCRIPTION"
echo "      - $GMAIL_PULL_SUBSCRIPTION"
echo "   4. Check for old/inactive subscriptions and delete them"
echo

echo "Step 2: Enable server-side cleanup on shutdown"
echo "   Add to your .env file:"
echo "   GOOGLE_REMOVE_ACTIVE_WATCHERS=true"
echo "   This will automatically clean up watches when server shuts down"
echo

echo "Step 3: Use the built-in cleanup endpoints"
echo "   The server has several cleanup endpoints (requires authentication)"
echo

# Function to demonstrate cleanup with user input
perform_cleanup() {
    echo "🎯 Interactive Cleanup Mode"
    echo "========================="
    echo
    
    # Use default token or ask user for custom token
    read -p "🔑 Use default JWT token? (Y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "Please enter your custom JWT token:"
        read -s JWT_TOKEN
        echo
        
        if [ -z "$JWT_TOKEN" ]; then
            echo "❌ No token provided. Exiting."
            return
        fi
    else
        JWT_TOKEN="$DEFAULT_JWT_TOKEN"
        echo "✅ Using provided default JWT token"
    fi
    
    echo "🔍 Available cleanup actions:"
    echo "1. Check active watches"
    echo "2. Cleanup inactive sessions"
    echo "3. Force stop all watches (DANGEROUS)"
    echo "4. Check webhook health (no auth required)"
    echo "5. Exit"
    echo
    
    read -p "Choose an action (1-5): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            echo "📊 Checking active watches..."
            echo "Endpoint: GET $API_BASE/api/gmail/debug/watch-status"
            curl -s "$API_BASE/api/gmail/debug/watch-status" \
                 -H "Authorization: Bearer $JWT_TOKEN" | jq '.' || echo "Response received (install jq for formatting)"
            ;;
        2)
            echo "🧹 Cleaning up inactive sessions..."
            echo "Endpoint: POST $API_BASE/api/gmail/watch/cleanup"
            curl -s -X POST "$API_BASE/api/gmail/watch/cleanup" \
                 -H "Authorization: Bearer $JWT_TOKEN" \
                 -H "Content-Type: application/json" | jq '.' || echo "Response received"
            ;;
        3)
            echo "⚠️  WARNING: This will stop ALL Gmail watches!"
            read -p "Are you sure? Type 'YES' to confirm: " confirm
            if [ "$confirm" = "YES" ]; then
                echo "🛑 Force stopping all watches..."
                echo "Endpoint: POST $API_BASE/api/gmail/debug/force-stop-all"
                curl -s -X POST "$API_BASE/api/gmail/debug/force-stop-all" \
                     -H "Authorization: Bearer $JWT_TOKEN" \
                     -H "Content-Type: application/json" | jq '.' || echo "Response received"
            else
                echo "❌ Cancelled"
            fi
            ;;
        4)
            echo "🏥 Checking webhook health (no authentication required)..."
            echo "Endpoint: GET $API_BASE/api/gmail/webhooks/health"
            curl -s "$API_BASE/api/gmail/webhooks/health" | jq '.' || echo "Response received"
            ;;
        5)
            echo "👋 Exiting"
            return
            ;;
        *)
            echo "❌ Invalid option"
            ;;
    esac
    
    echo
    echo "🔄 Would you like to perform another action?"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        perform_cleanup
    fi
}

# Quick action functions
quick_check_status() {
    echo "🚀 Quick Status Check"
    echo "===================="
    echo
    
    JWT_TOKEN="$DEFAULT_JWT_TOKEN"
    
    echo "1. 🏥 Checking webhook health..."
    curl -s "$API_BASE/api/gmail/webhooks/health" | jq '.status, .watchStats' 2>/dev/null || echo "Webhook health check completed"
    echo
    
    echo "2. 📊 Checking active watches in database..."
    curl -s "$API_BASE/api/gmail/debug/watch-status" \
         -H "Authorization: Bearer $JWT_TOKEN" | jq '.debug.database.totalWatches, .debug.database.watches[].email' 2>/dev/null || echo "Watch status check completed"
    echo
    
    echo "3. 🔍 Checking for account mismatches..."
    curl -s "$API_BASE/api/gmail/debug/account-mismatch" \
         -H "Authorization: Bearer $JWT_TOKEN" | jq '.totalActiveWatches, .orphanedNotifications.detected' 2>/dev/null || echo "Account mismatch check completed"
    echo
}

quick_cleanup() {
    echo "⚡ Quick Cleanup (Force Stop All Watches)"
    echo "========================================"
    echo
    
    JWT_TOKEN="$DEFAULT_JWT_TOKEN"
    
    echo "⚠️  WARNING: This will stop ALL Gmail watches!"
    echo "This is useful for cleaning up orphaned watches completely."
    echo
    read -p "Are you sure you want to continue? Type 'YES' to confirm: " confirm
    
    if [ "$confirm" = "YES" ]; then
        echo "🛑 Force stopping all watches..."
        echo "Endpoint: POST $API_BASE/api/gmail/debug/force-stop-all"
        
        response=$(curl -s -X POST "$API_BASE/api/gmail/debug/force-stop-all" \
                       -H "Authorization: Bearer $JWT_TOKEN" \
                       -H "Content-Type: application/json")
        
        echo "Response:"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        echo
        echo "✅ Cleanup completed!"
    else
        echo "❌ Cleanup cancelled"
    fi
}

echo "🚀 Quick Actions:"
echo "================"
echo

# Main menu
echo "Choose an option:"
echo "1. 📊 Quick status check (check all systems)"
echo "2. ⚡ Quick cleanup (force stop all watches)"
echo "3. 🎯 Interactive cleanup (step-by-step)"
echo "4. ℹ️  Show manual instructions only"
echo

read -p "Choose an option (1-4): " -n 1 -r
echo

case $REPLY in
    1)
        quick_check_status
        ;;
    2)
        quick_cleanup
        ;;
    3)
        perform_cleanup
        ;;
    4)
        echo "ℹ️  Manual cleanup instructions provided above."
        ;;
    *)
        echo "❌ Invalid option. Showing manual instructions."
        ;;
esac

echo
echo "📚 Additional Resources:"
echo "======================="
echo "• Webhook Authentication Guide: guides/email-system/WEBHOOK_AUTHENTICATION_GUIDE.md"
echo "• Orphaned Watches Guide: guides/email-system/ORPHANED_WATCHES_TROUBLESHOOTING.md"
echo "• Client Integration Guide: guides/email-system/CLIENT_INTEGRATION_GUIDE.md"
echo "• Server logs: Check for 'No active watch found for email' warnings"
echo
echo "🔧 Environment Configuration:"
echo "============================"
echo "Current Gmail settings from .env:"
echo "• Project ID: ${GOOGLE_CLOUD_PROJECT_ID:-'Not set'}"
echo "• Push Subscription: ${GMAIL_PUSH_SUBSCRIPTION:-'Not set'}"
echo "• Pull Subscription: ${GMAIL_PULL_SUBSCRIPTION:-'Not set'}"
echo "• Topic: ${GMAIL_PUBSUB_TOPIC:-'Not set'}"
echo "• Auto-cleanup on shutdown: ${GOOGLE_REMOVE_ACTIVE_WATCHERS:-'false'}"
echo
echo "🔑 JWT Token Info:"
echo "• Using default token for user: abc@gmail.com"
echo "• Token can be overridden in interactive mode if needed"
echo
echo "✨ Done! Check the server logs for any 'No active watch found' warnings to identify orphaned watches." 
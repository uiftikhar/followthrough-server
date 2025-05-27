#!/bin/bash

# FollowThrough AI Zapier Integration Setup Script
# This script helps set up the Zapier CLI package for development

set -e

echo "🚀 Setting up FollowThrough AI Zapier Integration..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the zapier-packages/followthrough-ai-integration directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Zapier CLI is installed
if ! command -v zapier &> /dev/null; then
    echo "📦 Installing Zapier CLI globally..."
    npm install -g zapier-platform-cli
else
    echo "✅ Zapier CLI is already installed"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# Zapier CLI Configuration
ZAPIER_DEPLOY_KEY=your_zapier_deploy_key_here

# FollowThrough AI API
FOLLOWTHROUGH_API_URL=https://your-domain.com
FOLLOWTHROUGH_API_KEY=your_api_key_here

# Google OAuth (same as your server)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# MCP Server URLs (optional)
GMAIL_MCP_SERVER=https://your-domain.com/mcp/gmail
CALENDAR_MCP_SERVER=https://your-domain.com/mcp/calendar
EOL
    echo "✅ Created .env file - please update with your actual values"
else
    echo "✅ .env file already exists"
fi

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo "📝 Creating .gitignore file..."
    cat > .gitignore << EOL
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build output
lib/
dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Zapier
.zapierapprc

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Coverage
coverage/
.nyc_output/

# TypeScript
*.tsbuildinfo
EOL
    echo "✅ Created .gitignore file"
else
    echo "✅ .gitignore file already exists"
fi

# Build the project
echo "🔨 Building the project..."
npm run build

# Validate the Zapier app
echo "✅ Validating Zapier app..."
npm run validate

echo ""
echo "🎉 Setup complete! Next steps:"
echo ""
echo "1. Update the .env file with your actual credentials:"
echo "   - ZAPIER_DEPLOY_KEY: Get from https://zapier.com/app/developer"
echo "   - FOLLOWTHROUGH_API_URL: Your FollowThrough AI server URL"
echo "   - FOLLOWTHROUGH_API_KEY: Your API key from the dashboard"
echo "   - GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET: From Google Cloud Console"
echo ""
echo "2. Test the integration:"
echo "   npm test"
echo ""
echo "3. Deploy to Zapier:"
echo "   npm run push"
echo ""
echo "4. Check the README.md for detailed documentation"
echo ""
echo "Happy coding! 🚀" 
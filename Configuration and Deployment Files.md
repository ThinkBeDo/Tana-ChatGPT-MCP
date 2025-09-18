---
title: Configuration and Deployment Files
type: note
permalink: tana-mcp-project/configuration-and-deployment-files
---

# Environment Configuration and TypeScript Config

## .env file
```
TANA_API_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJmaWxlSWQiOiJnRVpCRlNfaUFBIiwiY3JlYXRlZCI6MTc1MjYwMTEyODY2NCwidG9rZW5JZCI6IkRrVHFabThaR08xUiJ9.nRzWMQweL7aopxXY80sqznKBfJVtdMpBB9F6bDy9JAo
MCP_SERVER_KEY=tana-mcp-secret-key-2024
PORT=3000
```

## tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Railway deployment script (deploy-railway.sh)
```bash
#!/bin/bash
set -e

echo "🚀 Deploying Tana MCP Server to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway (if not already logged in)
echo "Checking Railway authentication..."
railway auth

# Initialize Railway project if needed
if [ ! -f "railway.json" ]; then
    echo "Initializing Railway project..."
    railway init
fi

# Set environment variables
echo "Setting environment variables..."
railway variables set TANA_API_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJmaWxlSWQiOiJnRVpCRlNfaUFBIiwiY3JlYXRlZCI6MTc1MjYwMTEyODY2NCwidG9rZW5JZCI6IkRrVHFabThaR08xUiJ9.nRzWMQweL7aopxXY80sqznKBfJVtdMpBB9F6bDy9JAo"
railway variables set MCP_SERVER_KEY="tana-mcp-secret-key-2024"
railway variables set PORT="3000"

# Deploy
echo "Deploying to Railway..."
railway up --detach

# Get the URL
echo "Getting deployment URL..."
URL=$(railway domain)

# Create domain if it doesn't exist
if [ -z "$URL" ]; then
    echo "No domain found, creating one..."
    railway domain create
    URL=$(railway domain)
fi

echo ""
echo "✅ Deployment complete!"
echo "🌐 Server URL: https://$URL"
echo "🔗 MCP Endpoint: https://$URL/mcp"
echo ""
echo "Next steps:"
echo "1. Test with: curl -H 'Authorization: Bearer tana-mcp-secret-key-2024' https://$URL/health"
echo "2. Add to ChatGPT: Server URL = https://$URL/mcp, Headers = Authorization: Bearer tana-mcp-secret-key-2024"
```

## Test script (test-inspector.sh)
```bash
#!/bin/bash

# Test with MCP Inspector
if [ -z "$1" ]; then
    echo "Usage: ./test-inspector.sh <server-url>"
    echo "Example: ./test-inspector.sh https://your-domain.railway.app/mcp"
    exit 1
fi

SERVER_URL=$1

echo "🧪 Testing MCP Server with Inspector..."
echo "Server URL: $SERVER_URL"
echo ""

# Install MCP Inspector if not available
if ! command -v @modelcontextprotocol/inspector &> /dev/null; then
    echo "Installing MCP Inspector..."
    npm install -g @modelcontextprotocol/inspector
fi

# Run inspector
npx @modelcontextprotocol/inspector \
  --transport http \
  --url "$SERVER_URL" \
  --headers "Authorization: Bearer tana-mcp-secret-key-2024"
```
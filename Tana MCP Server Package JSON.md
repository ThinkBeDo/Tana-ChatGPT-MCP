---
title: Tana MCP Server Package JSON
type: note
permalink: tana-mcp-project/tana-mcp-server-package-json
---

# Tana MCP Server Package.json

```json
{
  "name": "tana-mcp-chatgpt",
  "version": "1.0.0",
  "description": "Tana MCP Server for ChatGPT with HTTP Streamable Transport",
  "main": "dist/server-http.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server-http.js",
    "dev": "tsx src/server-http.ts",
    "test": "node dist/test-server.js",
    "test-inspector": "./test-inspector.sh"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```
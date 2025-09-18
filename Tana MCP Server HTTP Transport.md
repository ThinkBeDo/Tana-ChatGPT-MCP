---
title: Tana MCP Server HTTP Transport
type: note
permalink: tana-mcp-project/tana-mcp-server-http-transport
---

# Tana MCP Server HTTP Implementation

```typescript
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createTanaMCPServer } from './tana-mcp-server.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;
const MCP_SERVER_KEY = process.env.MCP_SERVER_KEY || 'dev-key-change-in-production';

// CORS configuration for ChatGPT
const allowedOrigins = [
  'https://chatgpt.com',
  'https://chat.openai.com',
  'http://localhost:3000',
  'http://localhost:8080',
  'https://localhost:3000'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  exposedHeaders: ['Mcp-Session-Id'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Session management
const activeSessions = new Map<string, any>();

function getOrCreateSession(sessionId?: string): { sessionId: string; transport: any } {
  if (sessionId && activeSessions.has(sessionId)) {
    return activeSessions.get(sessionId);
  }
  
  const newSessionId = sessionId || generateSessionId();
  const server = createTanaMCPServer();
  const transport = new StreamableHTTPServerTransport(server, {
    sessionId: newSessionId,
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });
  
  const session = { sessionId: newSessionId, transport };
  activeSessions.set(newSessionId, session);
  
  return session;
}

function generateSessionId(): string {
  return 'mcp-session-' + Math.random().toString(36).substr(2, 9);
}

// Authentication middleware
function authenticateRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  
  const token = authHeader.substring(7);
  if (token !== MCP_SERVER_KEY) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
  
  next();
}

// Main MCP endpoint - handles all MCP communication
app.all('/mcp', authenticateRequest, async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string;
    const { sessionId: actualSessionId, transport } = getOrCreateSession(sessionId);
    
    // Set session ID in response header
    res.setHeader('Mcp-Session-Id', actualSessionId);
    
    // Handle the request through the transport
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('MCP request error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: activeSessions.size
  });
});

// Session cleanup endpoint
app.delete('/mcp/sessions/:sessionId', authenticateRequest, (req, res) => {
  const { sessionId } = req.params;
  if (activeSessions.has(sessionId)) {
    activeSessions.delete(sessionId);
    res.json({ message: 'Session cleaned up successfully' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Tana MCP Server started on port ${PORT}`);
  console.log(`🔗 MCP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth required: Bearer ${MCP_SERVER_KEY}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  activeSessions.clear();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  activeSessions.clear();
  process.exit(0);
});
```
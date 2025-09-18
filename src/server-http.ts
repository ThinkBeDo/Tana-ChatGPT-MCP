import cors from 'cors';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createTanaMCPServer } from './tana-mcp-server.js';

loadEnv();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MCP_SERVER_KEY = process.env.MCP_SERVER_KEY || 'dev-key-change-in-production';

const allowedOrigins = [
  'https://chatgpt.com',
  'https://chat.openai.com',
  'http://localhost:3000',
  'http://localhost:8080',
  'https://localhost:3000',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  exposedHeaders: ['Mcp-Session-Id'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Mcp-Session-Id',
    'Mcp-Protocol-Version',
    'Accept',
  ],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

type SessionState = {
  sessionId: string;
  transport: StreamableHTTPServerTransport;
  server: ReturnType<typeof createTanaMCPServer>;
};

const sessions = new Map<string, SessionState>();

function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.substring('Bearer '.length);
  if (token !== MCP_SERVER_KEY) {
    res.status(401).json({ error: 'Invalid authentication token' });
    return;
  }

  next();
}

function parseSessionId(headerValue: string | string[] | undefined): string | undefined {
  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }

  return headerValue;
}

async function createSession(explicitSessionId?: string): Promise<SessionState> {
  const sessionId = explicitSessionId ?? generateSessionId();
  const server = createTanaMCPServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
  });

  transport.onclose = () => {
    sessions.delete(sessionId);
  };
  transport.onerror = (error) => {
    console.error(`MCP transport error for session ${sessionId}:`, error);
  };

  await server.connect(transport);

  const state: SessionState = { sessionId, server, transport };
  sessions.set(sessionId, state);
  return state;
}

function generateSessionId() {
  return `mcp-session-${randomUUID()}`;
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
  });
});

app.all('/mcp', authenticateRequest, async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  try {
    const sessionHeader = parseSessionId(req.headers['mcp-session-id']);

    let session: SessionState | undefined;
    if (sessionHeader && sessions.has(sessionHeader)) {
      session = sessions.get(sessionHeader);
    } else if (req.method === 'POST' && isInitializeRequest(req.body)) {
      session = await createSession(sessionHeader);
    }

    if (!session) {
      if (sessionHeader) {
        res.status(404).json({ error: 'Session not found' });
      } else {
        res.status(400).json({ error: 'Mcp-Session-Id header is required after initialization' });
      }
      return;
    }

    res.setHeader('Mcp-Session-Id', session.sessionId);
    await session.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

app.delete('/mcp/sessions/:sessionId', authenticateRequest, async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  try {
    await session.server.close();
    sessions.delete(sessionId);
    res.json({ message: `Session ${sessionId} closed` });
  } catch (error) {
    console.error(`Error closing session ${sessionId}:`, error);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Tana MCP Server started on port ${PORT}`);
  console.log(`🔗 MCP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log('🔐 Authentication required: Bearer token');
});

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  for (const [sessionId, session] of sessions.entries()) {
    try {
      await session.server.close();
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  sessions.clear();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

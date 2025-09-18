import express from 'express';
import cors from 'cors';
import { TanaMCPServer } from './tana-mcp-server.js';

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration for ChatGPT
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
  exposedHeaders: ['Mcp-Session-Id']
}));

app.use(express.json());

// Authentication middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.MCP_SERVER_KEY || 'tana-mcp-secret-key-2024';
  
  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Tana MCP Server
const tanaMCPServer = new TanaMCPServer();

// MCP endpoint
app.post('/mcp', authenticate, async (req, res) => {
  try {
    const response = await tanaMCPServer.handleRequest(req.body);
    res.json(response);
  } catch (error) {
    console.error('MCP request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Tana MCP Server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
});
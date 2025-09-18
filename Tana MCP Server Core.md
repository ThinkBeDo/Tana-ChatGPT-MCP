---
title: Tana MCP Server Core
type: note
permalink: tana-mcp-project/tana-mcp-server-core
---

# Tana MCP Server Core Implementation

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const TANA_API_BASE = 'https://europe-west1-tagr-prod.cloudfunctions.net/addToNodeV2';
const TANA_API_TOKEN = process.env.TANA_API_TOKEN;

if (!TANA_API_TOKEN) {
  throw new Error('TANA_API_TOKEN environment variable is required');
}

interface TanaNode {
  name?: string;
  description?: string;
  supertags?: Array<{
    id: string;
    fields?: Record<string, string>;
  }>;
  targetNodeId?: string;
}

export function createTanaMCPServer(): Server {
  const server = new Server(
    {
      name: 'tana-mcp-chatgpt',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Tool definitions
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'create_plain_node',
          description: 'Create a plain text node in Tana',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the node' },
              description: { type: 'string', description: 'Description of the node' },
              targetNodeId: { type: 'string', description: 'Parent node ID (optional)' },
              supertags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    fields: { type: 'object' }
                  }
                }
              }
            },
            required: ['name']
          }
        },
        {
          name: 'create_reference_node',
          description: 'Create a reference node in Tana',
          inputSchema: {
            type: 'object',
            properties: {
              referenceId: { type: 'string', description: 'ID of the node to reference' },
              targetNodeId: { type: 'string', description: 'Parent node ID (optional)' }
            },
            required: ['referenceId']
          }
        },
        {
          name: 'create_date_node',
          description: 'Create a date node in Tana',
          inputSchema: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
              description: { type: 'string', description: 'Description of the date node' },
              targetNodeId: { type: 'string', description: 'Parent node ID (optional)' },
              supertags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    fields: { type: 'object' }
                  }
                }
              }
            },
            required: ['date']
          }
        },
        {
          name: 'create_url_node',
          description: 'Create a URL node in Tana',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', format: 'uri', description: 'URL to create' },
              description: { type: 'string', description: 'Description of the URL node' },
              targetNodeId: { type: 'string', description: 'Parent node ID (optional)' },
              supertags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    fields: { type: 'object' }
                  }
                }
              }
            },
            required: ['url']
          }
        }
      ]
    };
  });

  // Tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'create_plain_node':
          return await createPlainNode(args as any);
        case 'create_reference_node':
          return await createReferenceNode(args as any);
        case 'create_date_node':
          return await createDateNode(args as any);
        case 'create_url_node':
          return await createUrlNode(args as any);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
      }
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to execute tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  return server;
}

// Tool implementations
async function createPlainNode(args: { name: string; description?: string; targetNodeId?: string; supertags?: any[] }) {
  const payload = {
    name: args.name,
    description: args.description,
    supertags: args.supertags,
    targetNodeId: args.targetNodeId
  };

  const response = await makeApiCall(payload);
  return {
    content: [
      {
        type: 'text',
        text: `Created plain node: ${args.name}${response.nodeId ? ` (ID: ${response.nodeId})` : ''}`
      }
    ]
  };
}

async function createReferenceNode(args: { referenceId: string; targetNodeId?: string }) {
  const payload = {
    referenceId: args.referenceId,
    targetNodeId: args.targetNodeId
  };

  const response = await makeApiCall(payload);
  return {
    content: [
      {
        type: 'text',
        text: `Created reference node to: ${args.referenceId}${response.nodeId ? ` (ID: ${response.nodeId})` : ''}`
      }
    ]
  };
}

async function createDateNode(args: { date: string; description?: string; targetNodeId?: string; supertags?: any[] }) {
  const payload = {
    date: args.date,
    description: args.description,
    supertags: args.supertags,
    targetNodeId: args.targetNodeId
  };

  const response = await makeApiCall(payload);
  return {
    content: [
      {
        type: 'text',
        text: `Created date node: ${args.date}${response.nodeId ? ` (ID: ${response.nodeId})` : ''}`
      }
    ]
  };
}

async function createUrlNode(args: { url: string; description?: string; targetNodeId?: string; supertags?: any[] }) {
  const payload = {
    url: args.url,
    description: args.description,
    supertags: args.supertags,
    targetNodeId: args.targetNodeId
  };

  const response = await makeApiCall(payload);
  return {
    content: [
      {
        type: 'text',
        text: `Created URL node: ${args.url}${response.nodeId ? ` (ID: ${response.nodeId})` : ''}`
      }
    ]
  };
}

async function makeApiCall(payload: any) {
  try {
    const response = await axios.post(TANA_API_BASE, payload, {
      headers: {
        'Authorization': `Bearer ${TANA_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Tana API error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}
```
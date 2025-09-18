import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const TANA_API_BASE = 'https://europe-west1-tagr-prod.cloudfunctions.net/addToNodeV2';

interface TanaNode {
  name?: string;
  description?: string;
  supertags?: Array<{
    id: string;
    fields?: Record<string, string>;
  }>;
  targetNodeId?: string;
  referenceId?: string;
  date?: string;
  url?: string;
}

export function createTanaMCPServer(): Server {
  ensureApiToken();

  const server = new Server(
    {
      name: 'tana-mcp-chatgpt',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'create_plain_node',
          description: 'Create a plain text node in Tana',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The name/content of the node' },
              description: { type: 'string', description: 'Optional description' },
              targetNodeId: { type: 'string', description: 'Parent node ID (optional)' },
              supertags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    fields: { type: 'object' },
                  },
                },
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'create_reference_node',
          description: 'Create a reference node in Tana',
          inputSchema: {
            type: 'object',
            properties: {
              referenceId: { type: 'string', description: 'ID of the node to reference' },
              targetNodeId: { type: 'string', description: 'Parent node ID (optional)' },
            },
            required: ['referenceId'],
          },
        },
        {
          name: 'create_date_node',
          description: 'Create a date node in Tana',
          inputSchema: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
              description: { type: 'string', description: 'Optional description' },
              targetNodeId: { type: 'string', description: 'Parent node ID (optional)' },
              supertags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    fields: { type: 'object' },
                  },
                },
              },
            },
            required: ['date'],
          },
        },
        {
          name: 'create_url_node',
          description: 'Create a URL node in Tana',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The URL to create a node for' },
              description: { type: 'string', description: 'Optional description' },
              targetNodeId: { type: 'string', description: 'Parent node ID (optional)' },
              supertags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    fields: { type: 'object' },
                  },
                },
              },
            },
            required: ['url'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'create_plain_node':
          return await createPlainNode(args as TanaNode);
        case 'create_reference_node':
          return await createReferenceNode(args as TanaNode);
        case 'create_date_node':
          return await createDateNode(args as TanaNode);
        case 'create_url_node':
          return await createUrlNode(args as TanaNode);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error executing tool ${name}:`, error);
      throw new McpError(ErrorCode.InternalError, `Failed to execute tool ${name}: ${message}`);
    }
  });

  return server;
}

async function createPlainNode(args: TanaNode) {
  const payload = {
    name: args.name,
    description: args.description,
    supertags: args.supertags,
    targetNodeId: args.targetNodeId,
  };

  const response = await makeApiCall(payload);
  return {
    content: [
      {
        type: 'text',
        text: `Created plain node: ${args.name ?? 'unknown'}${formatNodeId(response)}`,
      },
    ],
  };
}

async function createReferenceNode(args: TanaNode) {
  const payload = {
    referenceId: args.referenceId,
    targetNodeId: args.targetNodeId,
  };

  const response = await makeApiCall(payload);
  return {
    content: [
      {
        type: 'text',
        text: `Created reference node to ${args.referenceId ?? 'unknown'}${formatNodeId(response)}`,
      },
    ],
  };
}

async function createDateNode(args: TanaNode) {
  const payload = {
    date: args.date,
    description: args.description,
    supertags: args.supertags,
    targetNodeId: args.targetNodeId,
  };

  const response = await makeApiCall(payload);
  return {
    content: [
      {
        type: 'text',
        text: `Created date node: ${args.date ?? 'unknown'}${formatNodeId(response)}`,
      },
    ],
  };
}

async function createUrlNode(args: TanaNode) {
  const payload = {
    url: args.url,
    description: args.description,
    supertags: args.supertags,
    targetNodeId: args.targetNodeId,
  };

  const response = await makeApiCall(payload);
  return {
    content: [
      {
        type: 'text',
        text: `Created URL node: ${args.url ?? 'unknown'}${formatNodeId(response)}`,
      },
    ],
  };
}

async function makeApiCall(payload: Record<string, unknown>) {
  const apiToken = ensureApiToken();

  try {
    const response = await axios.post(TANA_API_BASE, payload, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = typeof error.response?.data === 'object'
        ? JSON.stringify(error.response?.data)
        : error.response?.data;
      throw new Error(`Tana API error${status ? ` (${status})` : ''}: ${detail ?? error.message}`);
    }

    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

function ensureApiToken() {
  const token = process.env.TANA_API_TOKEN;
  if (!token) {
    throw new Error('TANA_API_TOKEN environment variable is required');
  }

  return token;
}

function formatNodeId(response: unknown) {
  if (
    response &&
    typeof response === 'object' &&
    'nodeId' in response &&
    typeof (response as { nodeId?: unknown }).nodeId === 'string'
  ) {
    return ` (ID: ${(response as { nodeId: string }).nodeId})`;
  }

  return '';
}

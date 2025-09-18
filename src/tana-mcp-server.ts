import axios from 'axios';

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

export class TanaMCPServer {
  private apiToken: string;
  private baseUrl = 'https://europe-west1-tagr-prod.cloudfunctions.net/addToNodeV2';

  constructor() {
    this.apiToken = process.env.TANA_API_TOKEN || '';
    if (!this.apiToken) {
      throw new Error('TANA_API_TOKEN environment variable is required');
    }
  }

  async handleRequest(request: any): Promise<any> {
    const { method, params } = request;

    switch (method) {
      case 'tools/list':
        return this.listTools();
      
      case 'tools/call':
        return this.callTool(params);
      
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private listTools() {
    return {
      jsonrpc: "2.0",
      result: {
        tools: [
          {
            name: "create_plain_node",
            description: "Create a plain text node in Tana",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "The name/content of the node" },
                description: { type: "string", description: "Optional description" },
                targetNodeId: { type: "string", description: "Parent node ID (optional)" },
                supertags: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      fields: { type: "object" }
                    }
                  }
                }
              },
              required: ["name"]
            }
          },
          {
            name: "create_reference_node",
            description: "Create a reference node in Tana",
            inputSchema: {
              type: "object",
              properties: {
                referenceId: { type: "string", description: "ID of the node to reference" },
                targetNodeId: { type: "string", description: "Parent node ID (optional)" }
              },
              required: ["referenceId"]
            }
          },
          {
            name: "create_date_node",
            description: "Create a date node in Tana",
            inputSchema: {
              type: "object",
              properties: {
                date: { type: "string", description: "Date in YYYY-MM-DD format" },
                description: { type: "string", description: "Optional description" },
                targetNodeId: { type: "string", description: "Parent node ID (optional)" },
                supertags: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      fields: { type: "object" }
                    }
                  }
                }
              },
              required: ["date"]
            }
          },
          {
            name: "create_url_node",
            description: "Create a URL node in Tana",
            inputSchema: {
              type: "object",
              properties: {
                url: { type: "string", description: "The URL to create a node for" },
                description: { type: "string", description: "Optional description" },
                targetNodeId: { type: "string", description: "Parent node ID (optional)" },
                supertags: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      fields: { type: "object" }
                    }
                  }
                }
              },
              required: ["url"]
            }
          }
        ]
      }
    };
  }

  private async callTool(params: any) {
    const { name, arguments: args } = params;

    try {
      let result;
      switch (name) {
        case 'create_plain_node':
          result = await this.createPlainNode(args);
          break;
        case 'create_reference_node':
          result = await this.createReferenceNode(args);
          break;
        case 'create_date_node':
          result = await this.createDateNode(args);
          break;
        case 'create_url_node':
          result = await this.createUrlNode(args);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        jsonrpc: "2.0",
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        error: {
          code: -1,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async createPlainNode(args: TanaNode) {
    return this.callTanaAPI({
      name: args.name,
      description: args.description,
      supertags: args.supertags,
      targetNodeId: args.targetNodeId
    });
  }

  private async createReferenceNode(args: TanaNode) {
    return this.callTanaAPI({
      referenceId: args.referenceId,
      targetNodeId: args.targetNodeId
    });
  }

  private async createDateNode(args: TanaNode) {
    return this.callTanaAPI({
      date: args.date,
      description: args.description,
      supertags: args.supertags,
      targetNodeId: args.targetNodeId
    });
  }

  private async createUrlNode(args: TanaNode) {
    return this.callTanaAPI({
      url: args.url,
      description: args.description,
      supertags: args.supertags,
      targetNodeId: args.targetNodeId
    });
  }

  private async callTanaAPI(payload: any) {
    try {
      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Tana API Error:', error);
      throw new Error(`Tana API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
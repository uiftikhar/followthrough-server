import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { LangchainMcpAdapter } from './adapters/langchain-adapter';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

@Injectable()
export class MCPService {
  private readonly logger = new Logger(MCPService.name);
  private clients: Map<string, Client> = new Map();
  private multiServerClient: MultiServerMCPClient | null = null;

  constructor(
    private configService: ConfigService,
    private langchainAdapter: LangchainMcpAdapter,
  ) {}

  /**
   * Initialize a multi-server client for accessing all configured MCP servers
   */
  async initializeMultiServerClient(): Promise<MultiServerMCPClient> {
    if (this.multiServerClient) {
      return this.multiServerClient;
    }

    const serverConfigs = {};
    
    // Add Gmail MCP server if configured
    const gmailMcpServer = this.configService.get<string>('GMAIL_MCP_SERVER');
    if (gmailMcpServer) {
      serverConfigs['gmail'] = { url: gmailMcpServer };
    }
    
    // Add Outlook MCP server if configured
    const outlookMcpServer = this.configService.get<string>('OUTLOOK_MCP_SERVER');
    if (outlookMcpServer) {
      serverConfigs['outlook'] = { url: outlookMcpServer };
    }
    
    // Add Jira MCP server if configured
    const jiraMcpServer = this.configService.get<string>('JIRA_MCP_SERVER');
    if (jiraMcpServer) {
      serverConfigs['jira'] = { url: jiraMcpServer };
    }
    
    // Add Asana MCP server if configured
    const asanaMcpServer = this.configService.get<string>('ASANA_MCP_SERVER');
    if (asanaMcpServer) {
      serverConfigs['asana'] = { url: asanaMcpServer };
    }
    
    // Add Trello MCP server if configured
    const trelloMcpServer = this.configService.get<string>('TRELLO_MCP_SERVER');
    if (trelloMcpServer) {
      serverConfigs['trello'] = { url: trelloMcpServer };
    }
    
    // Add Zapier MCP server if configured
    const zapierMcpServer = this.configService.get<string>('ZAPIER_MCP_SERVER');
    if (zapierMcpServer) {
      serverConfigs['zapier'] = { url: zapierMcpServer };
    }
    
    if (Object.keys(serverConfigs).length === 0) {
      this.logger.warn('No MCP servers configured');
      throw new Error('No MCP servers configured');
    }
    
    this.multiServerClient = await this.langchainAdapter.createMultiServerClient(serverConfigs);
    return this.multiServerClient;
  }

  /**
   * Get all available tools from all configured MCP servers
   */
  async getAllAvailableTools(): Promise<any[]> {
    const client = await this.initializeMultiServerClient();
    return await this.langchainAdapter.loadAllTools(client);
  }

  /**
   * Get tools from specific MCP servers
   */
  async getToolsFromServers(serverNames: string[]): Promise<any[]> {
    const client = await this.initializeMultiServerClient();
    return await this.langchainAdapter.loadToolsFromServers(client, serverNames);
  }

  async connectToServer(serverUrl: string): Promise<boolean> {
    try {
      if (this.clients.has(serverUrl)) {
        return true;
      }

      const client = await this.langchainAdapter.createMcpClient(serverUrl);
      this.clients.set(serverUrl, client);
      
      this.logger.log(`Connected to MCP server: ${serverUrl}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to connect to MCP server: ${error.message}`);
      return false;
    }
  }

  async getResources(serverUrl: string, resourceType?: string): Promise<any[]> {
    try {
      const client = await this.getOrCreateClient(serverUrl);
      const resources = await client.listResources();
      
      // Filter resources by type if specified
      if (resourceType && Array.isArray(resources)) {
        return resources.filter(resource => 
          resource && typeof resource === 'object' && 'type' in resource && resource.type === resourceType
        );
      }
      
      return Array.isArray(resources) ? resources : [];
    } catch (error) {
      this.logger.error(`Failed to get resources: ${error.message}`);
      return [];
    }
  }

  async executeTool(serverUrl: string, toolId: string, params: any): Promise<any> {
    try {
      const client = await this.getOrCreateClient(serverUrl);
      const result = await client.callTool({
        name: toolId,
        arguments: params,
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to execute tool: ${error.message}`);
      throw error;
    }
  }

  async loadTools(serverUrl: string): Promise<any[]> {
    try {
      const client = await this.getOrCreateClient(serverUrl);
      const serverName = new URL(serverUrl).hostname;
      return await this.langchainAdapter.loadServerTools(serverName, client);
    } catch (error) {
      this.logger.error(`Failed to load tools: ${error.message}`);
      return [];
    }
  }

  /**
   * Execute a tool by its name with the provided parameters using the multi-server client
   */
  async executeToolAcrossServers(toolName: string, params: any): Promise<any> {
    try {
      const client = await this.initializeMultiServerClient();
      
      // If tool name contains server prefix (server__toolName), we need to get the right client
      if (toolName.includes('__')) {
        const [serverName, actualToolName] = toolName.split('__', 2);
        const serverClient = await client.getClient(serverName);
        
        if (!serverClient) {
          throw new Error(`No client found for server: ${serverName}`);
        }
        
        return await serverClient.callTool({
          name: actualToolName,
          arguments: params,
        });
      }
      
      // If no server prefix, try executing on all servers until one succeeds
      const tools = await this.langchainAdapter.loadAllTools(client);
      const matchingTool = tools.find(tool => tool.name === toolName);
      
      if (!matchingTool) {
        throw new Error(`No tool found with name: ${toolName}`);
      }
      
      // Execute using the tool's execute method
      return await matchingTool.invoke(params);
    } catch (error) {
      this.logger.error(`Failed to execute tool across servers: ${error.message}`);
      throw error;
    }
  }

  private async getOrCreateClient(serverUrl: string): Promise<Client> {
    if (!this.clients.has(serverUrl)) {
      await this.connectToServer(serverUrl);
    }
    
    const client = this.clients.get(serverUrl);
    if (!client) {
      throw new Error(`No client found for server: ${serverUrl}`);
    }
    
    return client;
  }
} 
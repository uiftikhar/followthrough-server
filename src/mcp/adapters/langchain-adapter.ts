import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Tool as LangchainTool } from '@langchain/core/tools';
import { MultiServerMCPClient, loadMcpTools } from '@langchain/mcp-adapters';

@Injectable()
export class LangchainMcpAdapter {
  private readonly logger = new Logger(LangchainMcpAdapter.name);

  constructor(
    private configService: ConfigService,
  ) {}

  /**
   * Creates a multi-server MCP client to interact with multiple MCP-enabled services
   */
  async createMultiServerClient(serverConfigs: {[key: string]: {url: string, headers?: Record<string, string>}}): Promise<MultiServerMCPClient> {
    try {
      const config = {
        mcpServers: {},
        prefixToolNameWithServerName: true,
      };
      
      // Convert server configs to the required format
      Object.entries(serverConfigs).forEach(([serverName, serverConfig]) => {
        config.mcpServers[serverName] = {
          url: serverConfig.url,
          type: 'http',
          headers: serverConfig.headers,
        };
      });
      
      this.logger.log(`Creating MultiServerMCPClient with ${Object.keys(serverConfigs).length} servers`);
      return new MultiServerMCPClient(config);
    } catch (error) {
      this.logger.error(`Failed to create MultiServerMCPClient: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load all tools from a multi-server client
   */
  async loadAllTools(client: MultiServerMCPClient): Promise<any[]> {
    try {
      // Initialize connections to all servers
      await client.initializeConnections();
      
      // Get all tools
      return await client.getTools();
    } catch (error) {
      this.logger.error(`Failed to load tools from MultiServerMCPClient: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load tools from specific servers in a multi-server client
   */
  async loadToolsFromServers(client: MultiServerMCPClient, serverNames: string[]): Promise<any[]> {
    try {
      // Initialize connections
      await client.initializeConnections();
      
      // Get tools from specified servers
      return await client.getTools(...serverNames);
    } catch (error) {
      this.logger.error(`Failed to load tools from servers ${serverNames.join(', ')}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates a single MCP client for a specific server
   */
  async createMcpClient(serverUrl: string, clientName: string = 'langchain-mcp-client'): Promise<Client> {
    try {
      const client = new Client({
        name: clientName,
        version: '1.0.0',
      });

      const transport = new StreamableHTTPClientTransport(
        new URL(serverUrl)
      );

      await client.connect(transport);
      return client;
    } catch (error) {
      this.logger.error(`Failed to create MCP client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load tools from a single server
   */
  async loadServerTools(serverName: string, client: Client): Promise<any[]> {
    try {
      return await loadMcpTools(serverName, client, {
        throwOnLoadError: false,
        prefixToolNameWithServerName: true,
      });
    } catch (error) {
      this.logger.error(`Failed to load tools from server ${serverName}: ${error.message}`);
      return [];
    }
  }
} 
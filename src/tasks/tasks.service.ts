import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MCPService } from '../mcp/mcp.service';
import { Task } from './models/task.model';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private readonly taskPlatforms = new Map<string, string>();

  constructor(
    private configService: ConfigService,
    private mcpService: MCPService,
  ) {
    // Initialize task platform MCP servers
    const jiraMcpServer = this.configService.get<string>('JIRA_MCP_SERVER');
    if (jiraMcpServer) {
      this.taskPlatforms.set('jira', jiraMcpServer);
    }
    
    const asanaMcpServer = this.configService.get<string>('ASANA_MCP_SERVER');
    if (asanaMcpServer) {
      this.taskPlatforms.set('asana', asanaMcpServer);
    }
    
    const trelloMcpServer = this.configService.get<string>('TRELLO_MCP_SERVER');
    if (trelloMcpServer) {
      this.taskPlatforms.set('trello', trelloMcpServer);
    }
  }

  /**
   * Create a task in the specified platform
   */
  async createTask(userId: string, platform: string, task: Partial<Task>): Promise<Task> {
    const serverUrl = this.taskPlatforms.get(platform);
    if (!serverUrl) {
      throw new Error(`Unsupported task platform: ${platform}`);
    }

    try {
      const result = await this.mcpService.executeTool(
        serverUrl,
        'createTask',
        {
          userId,
          task,
        }
      );
      
      return new Task(result.task);
    } catch (error) {
      this.logger.error(`Failed to create task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a specific task by ID
   */
  async getTask(userId: string, platform: string, taskId: string): Promise<Task> {
    const serverUrl = this.taskPlatforms.get(platform);
    if (!serverUrl) {
      throw new Error(`Unsupported task platform: ${platform}`);
    }

    try {
      const result = await this.mcpService.executeTool(
        serverUrl,
        'fetchTask',
        {
          userId,
          taskId,
        }
      );
      
      return new Task(result.task);
    } catch (error) {
      this.logger.error(`Failed to fetch task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all tasks for a user from a platform
   */
  async getTasks(userId: string, platform: string, options: any = {}): Promise<Task[]> {
    const serverUrl = this.taskPlatforms.get(platform);
    if (!serverUrl) {
      throw new Error(`Unsupported task platform: ${platform}`);
    }

    try {
      const result = await this.mcpService.executeTool(
        serverUrl,
        'fetchTasks',
        {
          userId,
          ...options,
        }
      );
      
      return result.tasks.map(task => new Task(task));
    } catch (error) {
      this.logger.error(`Failed to fetch tasks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(userId: string, platform: string, taskId: string, updates: Partial<Task>): Promise<Task> {
    const serverUrl = this.taskPlatforms.get(platform);
    if (!serverUrl) {
      throw new Error(`Unsupported task platform: ${platform}`);
    }

    try {
      const result = await this.mcpService.executeTool(
        serverUrl,
        'updateTask',
        {
          userId,
          taskId,
          updates,
        }
      );
      
      return new Task(result.task);
    } catch (error) {
      this.logger.error(`Failed to update task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(userId: string, platform: string, taskId: string): Promise<boolean> {
    const serverUrl = this.taskPlatforms.get(platform);
    if (!serverUrl) {
      throw new Error(`Unsupported task platform: ${platform}`);
    }

    try {
      const result = await this.mcpService.executeTool(
        serverUrl,
        'deleteTask',
        {
          userId,
          taskId,
        }
      );
      
      return result.success === true;
    } catch (error) {
      this.logger.error(`Failed to delete task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get supported task platforms
   */
  getSupportedPlatforms(): string[] {
    return Array.from(this.taskPlatforms.keys());
  }
} 
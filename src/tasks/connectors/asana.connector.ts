import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MCPService } from '../../mcp/mcp.service';
import { Task, TaskPriority, TaskStatus } from '../models/task.model';

@Injectable()
export class AsanaConnector {
  private readonly logger = new Logger(AsanaConnector.name);
  private readonly serverUrl: string;

  constructor(
    private configService: ConfigService,
    private mcpService: MCPService,
  ) {
    const asanaMcpServer = this.configService.get<string>('ASANA_MCP_SERVER');
    if (!asanaMcpServer) {
      this.logger.warn('Asana MCP server URL not configured');
    }
    this.serverUrl = asanaMcpServer || '';
  }

  /**
   * Create a task in Asana
   */
  async createTask(userId: string, task: Partial<Task>): Promise<Task> {
    try {
      if (!this.serverUrl) {
        throw new Error('Asana MCP server not configured');
      }

      const result = await this.mcpService.executeTool(
        this.serverUrl,
        'createAsanaTask',
        {
          userId,
          workspaceId: task.metadata?.workspaceId,
          projectId: task.metadata?.projectId,
          name: task.title,
          notes: task.description,
          assigneeEmail: task.assignee?.email,
          dueDate: task.dueDate,
        }
      );
      
      return this.mapAsanaTaskToTask(result);
    } catch (error) {
      this.logger.error(`Failed to create Asana task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch a specific task from Asana
   */
  async fetchTask(userId: string, taskId: string): Promise<Task> {
    try {
      if (!this.serverUrl) {
        throw new Error('Asana MCP server not configured');
      }

      const result = await this.mcpService.executeTool(
        this.serverUrl,
        'getAsanaTask',
        {
          userId,
          taskId,
        }
      );
      
      return this.mapAsanaTaskToTask(result);
    } catch (error) {
      this.logger.error(`Failed to fetch Asana task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch tasks from Asana
   */
  async fetchTasks(userId: string, options: any = {}): Promise<Task[]> {
    try {
      if (!this.serverUrl) {
        throw new Error('Asana MCP server not configured');
      }

      const result = await this.mcpService.executeTool(
        this.serverUrl,
        'getAsanaTasks',
        {
          userId,
          workspaceId: options.workspaceId,
          projectId: options.projectId,
          assigneeEmail: options.assignee,
          completed: options.completed,
          limit: options.limit || 50,
        }
      );
      
      return result.data.map(task => this.mapAsanaTaskToTask(task));
    } catch (error) {
      this.logger.error(`Failed to fetch Asana tasks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a task in Asana
   */
  async updateTask(userId: string, taskId: string, updates: Partial<Task>): Promise<Task> {
    try {
      if (!this.serverUrl) {
        throw new Error('Asana MCP server not configured');
      }

      const updateParams: any = {
        userId,
        taskId,
      };

      if (updates.title) updateParams.name = updates.title;
      if (updates.description) updateParams.notes = updates.description;
      if (updates.status) updateParams.completed = updates.status === TaskStatus.DONE;
      if (updates.dueDate) updateParams.dueDate = updates.dueDate;
      if (updates.assignee) updateParams.assigneeEmail = updates.assignee.email;

      const result = await this.mcpService.executeTool(
        this.serverUrl,
        'updateAsanaTask',
        updateParams
      );
      
      return this.mapAsanaTaskToTask(result);
    } catch (error) {
      this.logger.error(`Failed to update Asana task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a task in Asana
   */
  async deleteTask(userId: string, taskId: string): Promise<boolean> {
    try {
      if (!this.serverUrl) {
        throw new Error('Asana MCP server not configured');
      }

      const result = await this.mcpService.executeTool(
        this.serverUrl,
        'deleteAsanaTask',
        {
          userId,
          taskId,
        }
      );
      
      return result.deleted === true;
    } catch (error) {
      this.logger.error(`Failed to delete Asana task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper method to map Asana task to our Task model
   */
  private mapAsanaTaskToTask(asanaTask: any): Task {
    return new Task({
      id: asanaTask.gid,
      title: asanaTask.name,
      description: asanaTask.notes,
      status: this.mapAsanaStatusToTaskStatus(asanaTask.completed),
      priority: this.determineTaskPriority(asanaTask),
      dueDate: asanaTask.due_on,
      createdAt: asanaTask.created_at,
      updatedAt: asanaTask.modified_at,
      assignee: asanaTask.assignee ? {
        id: asanaTask.assignee.gid,
        name: asanaTask.assignee.name,
        email: asanaTask.assignee.email,
      } : undefined,
      platform: 'asana',
      externalIds: { asana: asanaTask.gid },
      url: `https://app.asana.com/0/${asanaTask.projects?.[0]?.gid || '0'}/${asanaTask.gid}`,
      metadata: {
        asana: {
          workspace: asanaTask.workspace?.name,
          projects: asanaTask.projects?.map(p => p.name),
          tags: asanaTask.tags?.map(t => t.name),
        },
      },
    });
  }

  /**
   * Map Asana completed flag to task status
   */
  private mapAsanaStatusToTaskStatus(completed?: boolean): TaskStatus {
    if (completed === true) {
      return TaskStatus.DONE;
    }
    return TaskStatus.TO_DO;
  }

  /**
   * Determine task priority from Asana task
   * (Asana doesn't have built-in priorities, so we infer from tags)
   */
  private determineTaskPriority(asanaTask: any): TaskPriority {
    // Check for priority-related tags
    if (asanaTask.tags && Array.isArray(asanaTask.tags)) {
      const tagNames = asanaTask.tags.map(tag => tag.name.toLowerCase());
      
      if (tagNames.some(tag => tag.includes('urgent') || tag.includes('p0'))) {
        return TaskPriority.URGENT;
      }
      
      if (tagNames.some(tag => tag.includes('high') || tag.includes('p1'))) {
        return TaskPriority.HIGH;
      }
      
      if (tagNames.some(tag => tag.includes('low'))) {
        return TaskPriority.LOW;
      }
    }
    
    // Default to medium priority
    return TaskPriority.MEDIUM;
  }
} 
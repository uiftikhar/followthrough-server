import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MCPService } from '../../mcp/mcp.service';
import { Task, TaskStatus, TaskPriority } from '../models/task.model';

@Injectable()
export class JiraConnector {
  private readonly logger = new Logger(JiraConnector.name);
  private readonly serverUrl: string;

  constructor(
    private configService: ConfigService,
    private mcpService: MCPService,
  ) {
    const jiraMcpServer = this.configService.get<string>('JIRA_MCP_SERVER');
    if (!jiraMcpServer) {
      this.logger.warn('Jira MCP server URL not configured');
    }
    this.serverUrl = jiraMcpServer || '';
  }

  /**
   * Create a task in Jira
   */
  async createTask(userId: string, task: Partial<Task>): Promise<Task> {
    try {
      if (!this.serverUrl) {
        throw new Error('Jira MCP server not configured');
      }

      const result = await this.mcpService.executeTool(
        this.serverUrl,
        'createJiraIssue',
        {
          userId,
          project: task.metadata?.project || 'default',
          summary: task.title,
          description: task.description || '',
          issueType: this.mapTaskTypeToJiraType(task.metadata?.type),
          priority: this.mapPriorityToJiraPriority(task.priority),
          dueDate: task.dueDate,
          assignee: task.assignee?.email,
        }
      );
      
      // Map the Jira response back to our Task model
      return new Task({
        id: result.id,
        title: result.summary,
        description: result.description,
        status: this.mapJiraStatusToTaskStatus(result.status),
        priority: this.mapJiraPriorityToTaskPriority(result.priority),
        dueDate: result.dueDate,
        createdAt: result.created,
        updatedAt: result.updated,
        assignee: result.assignee ? {
          id: result.assignee.accountId,
          name: result.assignee.displayName,
          email: result.assignee.emailAddress,
          avatarUrl: result.assignee.avatarUrl,
        } : undefined,
        platform: 'jira',
        externalIds: { jira: result.id },
        url: result.url,
        metadata: {
          jira: {
            project: result.project,
            issueType: result.issueType,
            key: result.key,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create Jira task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch a specific task from Jira
   */
  async fetchTask(userId: string, taskId: string): Promise<Task> {
    try {
      if (!this.serverUrl) {
        throw new Error('Jira MCP server not configured');
      }

      const result = await this.mcpService.executeTool(
        this.serverUrl,
        'getJiraIssue',
        {
          userId,
          issueId: taskId,
        }
      );
      
      // Map the Jira response to our Task model
      return this.mapJiraIssueToTask(result);
    } catch (error) {
      this.logger.error(`Failed to fetch Jira task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch tasks from Jira
   */
  async fetchTasks(userId: string, options: any = {}): Promise<Task[]> {
    try {
      if (!this.serverUrl) {
        throw new Error('Jira MCP server not configured');
      }

      const result = await this.mcpService.executeTool(
        this.serverUrl,
        'searchJiraIssues',
        {
          userId,
          project: options.project,
          assignee: options.assignee,
          status: options.status,
          maxResults: options.limit || 50,
        }
      );
      
      // Map the Jira issues to our Task model
      return result.issues.map(issue => this.mapJiraIssueToTask(issue));
    } catch (error) {
      this.logger.error(`Failed to fetch Jira tasks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a task in Jira
   */
  async updateTask(userId: string, taskId: string, updates: Partial<Task>): Promise<Task> {
    try {
      if (!this.serverUrl) {
        throw new Error('Jira MCP server not configured');
      }

      const updateParams: any = {
        userId,
        issueId: taskId,
      };

      // Only include fields that are being updated
      if (updates.title) updateParams.summary = updates.title;
      if (updates.description) updateParams.description = updates.description;
      if (updates.status) updateParams.status = this.mapTaskStatusToJiraStatus(updates.status);
      if (updates.priority) updateParams.priority = this.mapPriorityToJiraPriority(updates.priority);
      if (updates.dueDate) updateParams.dueDate = updates.dueDate;
      if (updates.assignee) updateParams.assignee = updates.assignee.email;

      const result = await this.mcpService.executeTool(
        this.serverUrl,
        'updateJiraIssue',
        updateParams
      );
      
      // Map the updated Jira issue to our Task model
      return this.mapJiraIssueToTask(result);
    } catch (error) {
      this.logger.error(`Failed to update Jira task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a task in Jira
   */
  async deleteTask(userId: string, taskId: string): Promise<boolean> {
    try {
      if (!this.serverUrl) {
        throw new Error('Jira MCP server not configured');
      }

      const result = await this.mcpService.executeTool(
        this.serverUrl,
        'deleteJiraIssue',
        {
          userId,
          issueId: taskId,
        }
      );
      
      return result.success === true;
    } catch (error) {
      this.logger.error(`Failed to delete Jira task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper method to map Jira issue to Task model
   */
  private mapJiraIssueToTask(jiraIssue: any): Task {
    return new Task({
      id: jiraIssue.id,
      title: jiraIssue.summary,
      description: jiraIssue.description,
      status: this.mapJiraStatusToTaskStatus(jiraIssue.status),
      priority: this.mapJiraPriorityToTaskPriority(jiraIssue.priority),
      dueDate: jiraIssue.dueDate,
      createdAt: jiraIssue.created,
      updatedAt: jiraIssue.updated,
      assignee: jiraIssue.assignee ? {
        id: jiraIssue.assignee.accountId,
        name: jiraIssue.assignee.displayName,
        email: jiraIssue.assignee.emailAddress,
        avatarUrl: jiraIssue.assignee.avatarUrl,
      } : undefined,
      platform: 'jira',
      externalIds: { jira: jiraIssue.id },
      url: jiraIssue.url,
      metadata: {
        jira: {
          project: jiraIssue.project,
          issueType: jiraIssue.issueType,
          key: jiraIssue.key,
        },
      },
    });
  }

  /**
   * Map task type to Jira issue type
   */
  private mapTaskTypeToJiraType(type?: string): string {
    // Default to 'Task' if no type is specified
    if (!type) return 'Task';
    
    // Map common task types to Jira issue types
    switch (type.toLowerCase()) {
      case 'bug':
        return 'Bug';
      case 'feature':
        return 'New Feature';
      case 'improvement':
        return 'Improvement';
      case 'epic':
        return 'Epic';
      default:
        return 'Task';
    }
  }

  /**
   * Map our task priority to Jira priority
   */
  private mapPriorityToJiraPriority(priority?: string): string {
    if (!priority) return 'Medium';
    
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'Highest';
      case 'high':
        return 'High';
      case 'medium':
        return 'Medium';
      case 'low':
        return 'Low';
      default:
        return 'Medium';
    }
  }

  /**
   * Map Jira priority to our task priority
   */
  private mapJiraPriorityToTaskPriority(jiraPriority?: string): TaskPriority {
    if (!jiraPriority) return TaskPriority.MEDIUM;
    
    switch (jiraPriority.toLowerCase()) {
      case 'highest':
      case 'blocker':
        return TaskPriority.URGENT;
      case 'high':
        return TaskPriority.HIGH;
      case 'medium':
        return TaskPriority.MEDIUM;
      case 'low':
      case 'lowest':
        return TaskPriority.LOW;
      default:
        return TaskPriority.MEDIUM;
    }
  }

  /**
   * Map Jira status to our task status
   */
  private mapJiraStatusToTaskStatus(jiraStatus?: string): TaskStatus {
    if (!jiraStatus) return TaskStatus.TO_DO;
    
    switch (jiraStatus.toLowerCase()) {
      case 'to do':
      case 'open':
      case 'backlog':
        return TaskStatus.TO_DO;
      case 'in progress':
      case 'in review':
        return TaskStatus.IN_PROGRESS;
      case 'done':
      case 'closed':
      case 'resolved':
        return TaskStatus.DONE;
      case 'cancelled':
        return TaskStatus.CANCELLED;
      default:
        return TaskStatus.TO_DO;
    }
  }

  /**
   * Map our task status to Jira status
   */
  private mapTaskStatusToJiraStatus(taskStatus?: string): string {
    if (!taskStatus) return 'To Do';
    
    switch (taskStatus.toLowerCase()) {
      case 'to_do':
        return 'To Do';
      case 'in_progress':
        return 'In Progress';
      case 'done':
        return 'Done';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'To Do';
    }
  }
} 
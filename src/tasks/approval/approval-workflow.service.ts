import { Injectable, Logger } from '@nestjs/common';
import { Task } from '../models/task.model';
import { ApprovalRequest } from './approval-request.model';
import { ApprovalStatus } from './approval-status.enum';
import { NotificationsService } from '../../notifications/notifications.service';
import { TasksService } from '../tasks.service';

@Injectable()
export class ApprovalWorkflowService {
  private readonly logger = new Logger(ApprovalWorkflowService.name);
  private readonly pendingApprovals = new Map<string, ApprovalRequest>();

  constructor(
    private notificationsService: NotificationsService,
    private tasksService: TasksService,
  ) {}

  /**
   * Create a new approval request for a task
   */
  async createApprovalRequest(
    userId: string,
    task: Task,
    metadata: any = {},
  ): Promise<ApprovalRequest> {
    try {
      const requestId = `approval-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      const request: ApprovalRequest = {
        id: requestId,
        userId,
        task,
        status: ApprovalStatus.PENDING,
        createdAt: new Date().toISOString(),
        metadata,
      };
      
      this.pendingApprovals.set(requestId, request);
      
      // Notify user about the pending approval
      await this.notificationsService.sendNotification(
        userId,
        {
          type: 'approval_request',
          title: 'Task Approval Required',
          body: `A new task "${task.title}" requires your approval.`,
          actionUrl: `/approvals/${requestId}`,
          data: {
            requestId,
            taskId: task.id,
            taskTitle: task.title,
          },
        }
      );
      
      return request;
    } catch (error) {
      this.logger.error(`Failed to create approval request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a specific approval request by ID
   */
  async getApprovalRequest(requestId: string): Promise<ApprovalRequest | null> {
    return this.pendingApprovals.get(requestId) || null;
  }

  /**
   * Get all pending approvals for a user
   */
  async getUserPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
    const userApprovals: ApprovalRequest[] = [];
    
    for (const [_, request] of this.pendingApprovals.entries()) {
      if (request.userId === userId && request.status === ApprovalStatus.PENDING) {
        userApprovals.push(request);
      }
    }
    
    return userApprovals;
  }

  /**
   * Get all approvals for a user (pending, approved, rejected)
   */
  async getUserApprovals(userId: string): Promise<ApprovalRequest[]> {
    const userApprovals: ApprovalRequest[] = [];
    
    for (const [_, request] of this.pendingApprovals.entries()) {
      if (request.userId === userId) {
        userApprovals.push(request);
      }
    }
    
    return userApprovals;
  }

  /**
   * Update an approval request status (approve or reject)
   */
  async updateApprovalRequest(
    requestId: string,
    status: ApprovalStatus,
    comments?: string,
  ): Promise<ApprovalRequest> {
    try {
      const request = this.pendingApprovals.get(requestId);
      if (!request) {
        throw new Error(`Approval request not found: ${requestId}`);
      }
      
      // Update request status
      request.status = status;
      request.updatedAt = new Date().toISOString();
      request.comments = comments;
      
      // Store updated request
      this.pendingApprovals.set(requestId, request);
      
      // Process the task based on approval status
      if (status === ApprovalStatus.APPROVED) {
        await this.processApprovedTask(request);
      }
      
      // Notify user about the status change
      await this.notificationsService.sendNotification(
        request.userId,
        {
          type: 'approval_updated',
          title: `Task ${this.getStatusText(status)}`,
          body: `The task "${request.task.title}" has been ${this.getStatusText(status).toLowerCase()}.`,
          data: {
            requestId,
            taskId: request.task.id,
            taskTitle: request.task.title,
            status,
          },
        }
      );
      
      return request;
    } catch (error) {
      this.logger.error(`Failed to update approval request: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Approve a task directly
   */
  async approveTask(
    userId: string,
    requestId: string,
    comments?: string,
  ): Promise<ApprovalRequest> {
    return this.updateApprovalRequest(requestId, ApprovalStatus.APPROVED, comments);
  }
  
  /**
   * Reject a task directly
   */
  async rejectTask(
    userId: string,
    requestId: string,
    comments?: string,
  ): Promise<ApprovalRequest> {
    return this.updateApprovalRequest(requestId, ApprovalStatus.REJECTED, comments);
  }
  
  /**
   * Process an approved task by creating it in the appropriate task platform
   */
  private async processApprovedTask(request: ApprovalRequest): Promise<void> {
    try {
      const { task, userId, metadata } = request;
      
      // Extract the target platform from metadata or use default
      const platform = metadata?.targetPlatform || task.platform || 'default';
      
      // Create the task in the specified platform
      if (platform !== 'default') {
        await this.tasksService.createTask(userId, platform, task);
      }
      
      this.logger.log(`Task "${task.title}" created successfully in ${platform}`);
    } catch (error) {
      this.logger.error(`Failed to process approved task: ${error.message}`);
      // Don't throw here to avoid breaking the approval flow
      // The task was approved but external creation failed
    }
  }
  
  /**
   * Get a human-readable status text
   */
  private getStatusText(status: ApprovalStatus): string {
    switch (status) {
      case ApprovalStatus.APPROVED:
        return 'Approved';
      case ApprovalStatus.REJECTED:
        return 'Rejected';
      case ApprovalStatus.PENDING:
        return 'Pending';
      case ApprovalStatus.CANCELLED:
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  }
} 
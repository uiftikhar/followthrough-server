export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TaskStatus {
  TO_DO = 'to_do',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export interface TaskAssignee {
  id?: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export class Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  assignee?: TaskAssignee;
  creator?: TaskAssignee;
  tags?: string[];
  platform?: string; // 'jira', 'asana', 'trello', etc.
  externalIds?: Record<string, string>; // Map of platform: externalId
  url?: string;
  metadata?: Record<string, any>;
  
  constructor(data: Partial<Task>) {
    this.id = data.id || '';
    this.title = data.title || '';
    this.description = data.description;
    this.status = data.status || TaskStatus.TO_DO;
    this.priority = data.priority || TaskPriority.MEDIUM;
    this.dueDate = data.dueDate;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt;
    this.completedAt = data.completedAt;
    this.assignee = data.assignee;
    this.creator = data.creator;
    this.tags = data.tags || [];
    this.platform = data.platform;
    this.externalIds = data.externalIds || {};
    this.url = data.url;
    this.metadata = data.metadata || {};
  }
  
  /**
   * Check if the task is overdue
   */
  isOverdue(): boolean {
    if (!this.dueDate) return false;
    if (this.status === TaskStatus.DONE) return false;
    
    const dueDate = new Date(this.dueDate);
    const now = new Date();
    
    return dueDate < now;
  }
  
  /**
   * Calculate days until the task is due
   */
  getDaysUntilDue(): number | null {
    if (!this.dueDate) return null;
    
    const dueDate = new Date(this.dueDate);
    const now = new Date();
    
    // Reset hours to compare only dates
    dueDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }
  
  /**
   * Add an external ID for a specific platform
   */
  addExternalId(platform: string, id: string): void {
    if (!this.externalIds) {
      this.externalIds = {};
    }
    
    this.externalIds[platform] = id;
  }
  
  /**
   * Get the external ID for a specific platform
   */
  getExternalId(platform: string): string | null {
    if (!this.externalIds) return null;
    
    return this.externalIds[platform] || null;
  }
  
  /**
   * Check if the task has an assignee
   */
  hasAssignee(): boolean {
    return !!this.assignee;
  }
  
  /**
   * Determine if the task is actionable
   * (has a due date, is not completed, and has an assignee)
   */
  isActionable(): boolean {
    return (
      this.status !== TaskStatus.DONE &&
      this.status !== TaskStatus.CANCELLED &&
      !!this.dueDate &&
      !!this.assignee
    );
  }
} 
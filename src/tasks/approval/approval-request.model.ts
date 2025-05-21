import { Task } from '../models/task.model';
import { ApprovalStatus } from './approval-status.enum';

export interface ApprovalRequest {
  id: string;
  userId: string;
  task: Task;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt?: string;
  comments?: string;
  metadata?: Record<string, any>;
} 
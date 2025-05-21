import { Email } from '../../email/models/email.model';
import { Task } from '../models/task.model';

/**
 * Interface for email task extraction strategies
 */
export interface IExtractionStrategy {
  /**
   * Extract tasks from an email
   * @param email The email to extract tasks from
   * @returns Array of extracted tasks
   */
  extractTasks(email: Email): Promise<Task[]>;
} 
import { Email } from '../models/email.model';
import { Thread } from '../models/thread.model';
import { EmailQueryDto } from '../dtos/email-query.dto';

export interface EmailConnector {
  /**
   * Get emails from the provider's service
   */
  getEmails(userId: string, query: EmailQueryDto): Promise<Email[]>;
  
  /**
   * Get a single email by ID
   */
  getEmail(userId: string, emailId: string): Promise<Email>;
  
  /**
   * Get a thread by ID
   */
  getThread(userId: string, threadId: string): Promise<Thread>;
  
  /**
   * Send an email
   */
  sendEmail(userId: string, email: Partial<Email>): Promise<Email>;
  
  /**
   * Update email metadata (labels, read status, etc.)
   */
  updateEmailMetadata(
    userId: string, 
    emailId: string, 
    metadata: Record<string, any>
  ): Promise<Email>;
  
  /**
   * Move an email to a different folder
   */
  moveEmail(
    userId: string, 
    emailId: string, 
    targetFolder: string
  ): Promise<Email>;
  
  /**
   * Delete an email
   */
  deleteEmail(userId: string, emailId: string): Promise<boolean>;
  
  /**
   * Mark an email as read or unread
   */
  markAsRead(
    userId: string, 
    emailId: string, 
    isRead: boolean
  ): Promise<Email>;
  
  /**
   * Get available folders/labels for the user
   */
  getFolders(userId: string): Promise<string[]>;
} 
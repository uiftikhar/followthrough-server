import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MCPService } from '../../mcp/mcp.service';
import { Email } from '../models/email.model';
import { Thread } from '../models/thread.model';
import { EmailConnector } from './email-connector.interface';
import { EmailQueryDto } from '../dtos/email-query.dto';

@Injectable()
export class GmailConnector implements EmailConnector {
  private readonly logger = new Logger(GmailConnector.name);
  private readonly mcpServerUrl: string;

  constructor(
    private configService: ConfigService,
    private mcpService: MCPService,
  ) {
    this.mcpServerUrl = this.configService.get<string>('GMAIL_MCP_SERVER', '');
    
    if (!this.mcpServerUrl) {
      this.logger.warn('GMAIL_MCP_SERVER environment variable is not set. Gmail integration will not function properly.');
    }
  }

  async getEmails(userId: string, query: EmailQueryDto): Promise<Email[]> {
    try {
      const result = await this.mcpService.executeTool(
        this.mcpServerUrl,
        'fetchEmails',
        {
          userId,
          ...this.formatQueryForMcp(query),
        }
      );
      
      return result.emails.map(email => new Email(email));
    } catch (error) {
      this.logger.error(`Failed to fetch emails from Gmail: ${error.message}`);
      throw error;
    }
  }

  async getEmail(userId: string, emailId: string): Promise<Email> {
    try {
      const result = await this.mcpService.executeTool(
        this.mcpServerUrl,
        'fetchEmail',
        {
          userId,
          emailId,
        }
      );
      
      return new Email(result.email);
    } catch (error) {
      this.logger.error(`Failed to fetch email from Gmail: ${error.message}`);
      throw error;
    }
  }

  async getThread(userId: string, threadId: string): Promise<Thread> {
    try {
      const result = await this.mcpService.executeTool(
        this.mcpServerUrl,
        'fetchThread',
        {
          userId,
          threadId,
        }
      );
      
      return new Thread(result.thread);
    } catch (error) {
      this.logger.error(`Failed to fetch thread from Gmail: ${error.message}`);
      throw error;
    }
  }

  async sendEmail(userId: string, email: Partial<Email>): Promise<Email> {
    try {
      const result = await this.mcpService.executeTool(
        this.mcpServerUrl,
        'sendEmail',
        {
          userId,
          email: this.formatEmailForSending(email),
        }
      );
      
      return new Email(result.email);
    } catch (error) {
      this.logger.error(`Failed to send email via Gmail: ${error.message}`);
      throw error;
    }
  }

  async updateEmailMetadata(
    userId: string, 
    emailId: string, 
    metadata: Record<string, any>
  ): Promise<Email> {
    try {
      const result = await this.mcpService.executeTool(
        this.mcpServerUrl,
        'updateEmailMetadata',
        {
          userId,
          emailId,
          metadata,
        }
      );
      
      return new Email(result.email);
    } catch (error) {
      this.logger.error(`Failed to update email metadata in Gmail: ${error.message}`);
      throw error;
    }
  }

  async moveEmail(
    userId: string, 
    emailId: string, 
    targetFolder: string
  ): Promise<Email> {
    try {
      const result = await this.mcpService.executeTool(
        this.mcpServerUrl,
        'moveEmail',
        {
          userId,
          emailId,
          targetFolder,
        }
      );
      
      return new Email(result.email);
    } catch (error) {
      this.logger.error(`Failed to move email in Gmail: ${error.message}`);
      throw error;
    }
  }

  async deleteEmail(userId: string, emailId: string): Promise<boolean> {
    try {
      const result = await this.mcpService.executeTool(
        this.mcpServerUrl,
        'deleteEmail',
        {
          userId,
          emailId,
        }
      );
      
      return result.success || false;
    } catch (error) {
      this.logger.error(`Failed to delete email in Gmail: ${error.message}`);
      throw error;
    }
  }

  async markAsRead(
    userId: string, 
    emailId: string, 
    isRead: boolean
  ): Promise<Email> {
    try {
      const result = await this.mcpService.executeTool(
        this.mcpServerUrl,
        'markAsRead',
        {
          userId,
          emailId,
          isRead,
        }
      );
      
      return new Email(result.email);
    } catch (error) {
      this.logger.error(`Failed to mark email as ${isRead ? 'read' : 'unread'} in Gmail: ${error.message}`);
      throw error;
    }
  }

  async getFolders(userId: string): Promise<string[]> {
    try {
      const result = await this.mcpService.executeTool(
        this.mcpServerUrl,
        'getFolders',
        {
          userId,
        }
      );
      
      return result.folders || [];
    } catch (error) {
      this.logger.error(`Failed to get folders from Gmail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format an email query for MCP
   */
  private formatQueryForMcp(query: EmailQueryDto): Record<string, any> {
    const formattedQuery: Record<string, any> = {};
    
    // Map query fields to Gmail-specific format
    if (query.query) formattedQuery.query = query.query;
    if (query.folder) formattedQuery.labelIds = [query.folder];
    if (query.labels) formattedQuery.labelIds = query.labels;
    if (query.unreadOnly) formattedQuery.unreadOnly = query.unreadOnly;
    if (query.hasAttachment) formattedQuery.hasAttachment = query.hasAttachment;
    if (query.startDate) formattedQuery.startDate = query.startDate;
    if (query.endDate) formattedQuery.endDate = query.endDate;
    if (query.from) formattedQuery.from = query.from;
    if (query.to) formattedQuery.to = query.to;
    
    // Pagination and sorting
    formattedQuery.maxResults = query.limit ?? 50;
    formattedQuery.pageToken = query.offset ? String(query.offset) : undefined;
    
    // Additional options
    formattedQuery.includeAttachments = query.includeAttachments ?? false;
    
    return formattedQuery;
  }

  /**
   * Format an email for sending via MCP
   */
  private formatEmailForSending(email: Partial<Email>): Record<string, any> {
    const formattedEmail: Record<string, any> = {};
    
    // Basic email fields
    if (email.subject) formattedEmail.subject = email.subject;
    if (email.body) formattedEmail.textBody = email.body;
    if (email.htmlBody) formattedEmail.htmlBody = email.htmlBody;
    
    // Recipients
    if (email.to) {
      formattedEmail.to = email.to.map(recipient => 
        typeof recipient === 'string' 
          ? recipient 
          : recipient.toString()
      );
    }
    
    if (email.cc) {
      formattedEmail.cc = email.cc.map(recipient => 
        typeof recipient === 'string' 
          ? recipient 
          : recipient.toString()
      );
    }
    
    if (email.bcc) {
      formattedEmail.bcc = email.bcc.map(recipient => 
        typeof recipient === 'string' 
          ? recipient 
          : recipient.toString()
      );
    }
    
    // Threading
    if (email.threadId) formattedEmail.threadId = email.threadId;
    if (email.inReplyTo) formattedEmail.inReplyTo = email.inReplyTo;
    
    // Attachments
    if (email.attachments) {
      formattedEmail.attachments = email.attachments.map(attachment => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: attachment.content,
      }));
    }
    
    return formattedEmail;
  }
} 
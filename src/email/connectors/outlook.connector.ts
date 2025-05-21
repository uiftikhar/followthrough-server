import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MCPService } from '../../mcp/mcp.service';
import { Email } from '../models/email.model';
import { Thread } from '../models/thread.model';
import { EmailConnector } from './email-connector.interface';
import { EmailQueryDto } from '../dtos/email-query.dto';

@Injectable()
export class OutlookConnector implements EmailConnector {
  private readonly logger = new Logger(OutlookConnector.name);
  private readonly mcpServerUrl: string;

  constructor(
    private configService: ConfigService,
    private mcpService: MCPService,
  ) {
    this.mcpServerUrl = this.configService.get<string>('OUTLOOK_MCP_SERVER', '');
    
    if (!this.mcpServerUrl) {
      this.logger.warn('OUTLOOK_MCP_SERVER environment variable is not set. Outlook integration will not function properly.');
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
      this.logger.error(`Failed to fetch emails from Outlook: ${error.message}`);
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
      this.logger.error(`Failed to fetch email from Outlook: ${error.message}`);
      throw error;
    }
  }

  async getThread(userId: string, threadId: string): Promise<Thread> {
    try {
      const result = await this.mcpService.executeTool(
        this.mcpServerUrl,
        'fetchConversation',
        {
          userId,
          conversationId: threadId,
        }
      );
      
      return new Thread({
        id: threadId,
        subject: result.subject,
        emails: result.messages,
      });
    } catch (error) {
      this.logger.error(`Failed to fetch thread from Outlook: ${error.message}`);
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
      this.logger.error(`Failed to send email via Outlook: ${error.message}`);
      throw error;
    }
  }

  async updateEmailMetadata(
    userId: string, 
    emailId: string, 
    metadata: Record<string, any>
  ): Promise<Email> {
    try {
      // Outlook has different endpoints for different metadata operations
      // We'll map the metadata object to the appropriate API calls
      
      let result;
      
      if (metadata.isRead !== undefined) {
        result = await this.mcpService.executeTool(
          this.mcpServerUrl,
          'markAsRead',
          {
            userId,
            emailId,
            isRead: metadata.isRead,
          }
        );
      }
      
      if (metadata.categories) {
        result = await this.mcpService.executeTool(
          this.mcpServerUrl,
          'updateCategories',
          {
            userId,
            emailId,
            categories: metadata.categories,
          }
        );
      }
      
      if (metadata.importance) {
        result = await this.mcpService.executeTool(
          this.mcpServerUrl,
          'updateImportance',
          {
            userId,
            emailId,
            importance: metadata.importance,
          }
        );
      }
      
      // If no specific metadata was handled, update generic properties
      if (!result) {
        result = await this.mcpService.executeTool(
          this.mcpServerUrl,
          'updateEmail',
          {
            userId,
            emailId,
            properties: metadata,
          }
        );
      }
      
      return new Email(result.email);
    } catch (error) {
      this.logger.error(`Failed to update email metadata in Outlook: ${error.message}`);
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
          targetFolderId: targetFolder,
        }
      );
      
      return new Email(result.email);
    } catch (error) {
      this.logger.error(`Failed to move email in Outlook: ${error.message}`);
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
      this.logger.error(`Failed to delete email in Outlook: ${error.message}`);
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
      this.logger.error(`Failed to mark email as ${isRead ? 'read' : 'unread'} in Outlook: ${error.message}`);
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
      
      return result.folders.map(folder => folder.displayName);
    } catch (error) {
      this.logger.error(`Failed to get folders from Outlook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format an email query for MCP
   */
  private formatQueryForMcp(query: EmailQueryDto): Record<string, any> {
    const formattedQuery: Record<string, any> = {};
    
    // Map query fields to Outlook-specific format
    if (query.query) formattedQuery.filter = query.query;
    if (query.folder) formattedQuery.folderId = query.folder;
    if (query.unreadOnly) formattedQuery.isUnread = query.unreadOnly;
    if (query.hasAttachment) formattedQuery.hasAttachments = query.hasAttachment;
    
    // Date filters require different format for Outlook
    if (query.startDate || query.endDate) {
      let dateFilter = '';
      
      if (query.startDate) {
        dateFilter += `receivedDateTime ge ${query.startDate}`;
      }
      
      if (query.endDate) {
        if (dateFilter) dateFilter += ' and ';
        dateFilter += `receivedDateTime le ${query.endDate}`;
      }
      
      if (dateFilter) {
        formattedQuery.filter = formattedQuery.filter
          ? `(${formattedQuery.filter}) and (${dateFilter})`
          : dateFilter;
      }
    }
    
    // From/To filters
    if (query.from) {
      const fromFilter = `from/emailAddress/address eq '${query.from}'`;
      formattedQuery.filter = formattedQuery.filter
        ? `(${formattedQuery.filter}) and (${fromFilter})`
        : fromFilter;
    }
    
    if (query.to) {
      const toFilter = `toRecipients/any(r: r/emailAddress/address eq '${query.to}')`;
      formattedQuery.filter = formattedQuery.filter
        ? `(${formattedQuery.filter}) and (${toFilter})`
        : toFilter;
    }
    
    // Pagination
    formattedQuery.top = query.limit ?? 50;
    formattedQuery.skip = query.offset ?? 0;
    
    // Sorting
    if (query.sortBy) {
      let orderBy = '';
      
      switch (query.sortBy) {
        case 'date':
          orderBy = 'receivedDateTime';
          break;
        case 'subject':
          orderBy = 'subject';
          break;
        case 'from':
          orderBy = 'from/emailAddress/address';
          break;
        case 'importance':
          orderBy = 'importance';
          break;
        default:
          orderBy = 'receivedDateTime';
      }
      
      formattedQuery.orderBy = `${orderBy} ${query.sortOrder === 'asc' ? 'asc' : 'desc'}`;
    }
    
    // Include body content and other details
    formattedQuery.expand = 'attachments';
    
    return formattedQuery;
  }

  /**
   * Format an email for sending via MCP
   */
  private formatEmailForSending(email: Partial<Email>): Record<string, any> {
    const formattedEmail: Record<string, any> = {
      message: {},
    };
    
    // Basic email fields
    if (email.subject) formattedEmail.message.subject = email.subject;
    
    // Body content
    formattedEmail.message.body = {
      contentType: email.htmlBody ? 'html' : 'text',
      content: email.htmlBody || email.body || '',
    };
    
    // Recipients
    if (email.to) {
      formattedEmail.message.toRecipients = email.to.map(recipient => {
        const emailStr = typeof recipient === 'string' 
          ? recipient 
          : recipient.toString();
        
        const matches = emailStr.match(/^(?:"?([^"]*)"?\s)?<?([^>]*)>?$/);
        
        if (matches && matches.length >= 3) {
          return {
            emailAddress: {
              name: matches[1]?.trim() || '',
              address: matches[2].trim(),
            },
          };
        }
        
        return {
          emailAddress: {
            address: emailStr.trim(),
          },
        };
      });
    }
    
    if (email.cc) {
      formattedEmail.message.ccRecipients = email.cc.map(recipient => {
        const emailStr = typeof recipient === 'string' 
          ? recipient 
          : recipient.toString();
        
        const matches = emailStr.match(/^(?:"?([^"]*)"?\s)?<?([^>]*)>?$/);
        
        if (matches && matches.length >= 3) {
          return {
            emailAddress: {
              name: matches[1]?.trim() || '',
              address: matches[2].trim(),
            },
          };
        }
        
        return {
          emailAddress: {
            address: emailStr.trim(),
          },
        };
      });
    }
    
    if (email.bcc) {
      formattedEmail.message.bccRecipients = email.bcc.map(recipient => {
        const emailStr = typeof recipient === 'string' 
          ? recipient 
          : recipient.toString();
        
        const matches = emailStr.match(/^(?:"?([^"]*)"?\s)?<?([^>]*)>?$/);
        
        if (matches && matches.length >= 3) {
          return {
            emailAddress: {
              name: matches[1]?.trim() || '',
              address: matches[2].trim(),
            },
          };
        }
        
        return {
          emailAddress: {
            address: emailStr.trim(),
          },
        };
      });
    }
    
    // Importance
    if (email.metadata?.importance) {
      formattedEmail.message.importance = email.metadata.importance;
    }
    
    // Attachments
    if (email.attachments && email.attachments.length > 0) {
      formattedEmail.message.attachments = email.attachments.map(attachment => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: attachment.filename,
        contentType: attachment.contentType,
        contentBytes: attachment.content,
      }));
    }
    
    // Save copy to sent items
    formattedEmail.saveToSentItems = true;
    
    return formattedEmail;
  }
} 
import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from './google-oauth.service';

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: any;
  sizeEstimate: number;
  raw?: string;
}

export interface GmailSendEmailParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  replyTo?: string;
  inReplyTo?: string; // Message ID for replies
  references?: string; // For threading
}

export interface GmailSearchParams {
  query?: string; // Gmail search query
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(private readonly googleOAuthService: GoogleOAuthService) {}

  /**
   * Get Gmail messages for a user
   */
  async getMessages(userId: string, searchParams: GmailSearchParams = {}): Promise<{
    messages: GmailMessage[];
    nextPageToken?: string;
    resultSizeEstimate: number;
  }> {
    try {
      const client = await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: 'v1', auth: client });

      // Build search parameters
      const params: any = {
        userId: 'me',
        maxResults: searchParams.maxResults || 20,
        includeSpamTrash: searchParams.includeSpamTrash || false,
      };

      if (searchParams.query) {
        params.q = searchParams.query;
      }

      if (searchParams.pageToken) {
        params.pageToken = searchParams.pageToken;
      }

      if (searchParams.labelIds && searchParams.labelIds.length > 0) {
        params.labelIds = searchParams.labelIds;
      }

      // Get message list
      const response = await gmail.users.messages.list(params);
      const messageIds = response.data.messages || [];

      // Get full message details
      const messages: GmailMessage[] = [];
      for (const messageRef of messageIds) {
        try {
          const messageDetail = await gmail.users.messages.get({
            userId: 'me',
            id: messageRef.id!,
          });
          messages.push(messageDetail.data as GmailMessage);
        } catch (error) {
          this.logger.warn(`Failed to get message ${messageRef.id}:`, error);
        }
      }

      this.logger.log(`Retrieved ${messages.length} messages for user: ${userId}`);

      return {
        messages,
        nextPageToken: response.data.nextPageToken || undefined,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get messages for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(userId: string, messageId: string): Promise<GmailMessage> {
    try {
      const client = await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: 'v1', auth: client });

      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
      });

      this.logger.log(`Retrieved message ${messageId} for user: ${userId}`);
      return response.data as GmailMessage;
    } catch (error) {
      this.logger.error(`Failed to get message ${messageId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send an email via Gmail
   */
  async sendEmail(userId: string, emailParams: GmailSendEmailParams): Promise<{ messageId: string }> {
    try {
      const client = await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: 'v1', auth: client });

      // Create email message
      const emailLines: string[] = [];
      
      // Headers
      emailLines.push(`To: ${Array.isArray(emailParams.to) ? emailParams.to.join(', ') : emailParams.to}`);
      
      if (emailParams.cc) {
        emailLines.push(`Cc: ${Array.isArray(emailParams.cc) ? emailParams.cc.join(', ') : emailParams.cc}`);
      }
      
      if (emailParams.bcc) {
        emailLines.push(`Bcc: ${Array.isArray(emailParams.bcc) ? emailParams.bcc.join(', ') : emailParams.bcc}`);
      }
      
      emailLines.push(`Subject: ${emailParams.subject}`);
      
      if (emailParams.replyTo) {
        emailLines.push(`Reply-To: ${emailParams.replyTo}`);
      }
      
      if (emailParams.inReplyTo) {
        emailLines.push(`In-Reply-To: ${emailParams.inReplyTo}`);
      }
      
      if (emailParams.references) {
        emailLines.push(`References: ${emailParams.references}`);
      }

      // Content-Type for HTML or plain text
      if (emailParams.htmlBody) {
        emailLines.push('Content-Type: text/html; charset=utf-8');
        emailLines.push('');
        emailLines.push(emailParams.htmlBody);
      } else {
        emailLines.push('Content-Type: text/plain; charset=utf-8');
        emailLines.push('');
        emailLines.push(emailParams.textBody || '');
      }

      // Encode as base64url
      const emailString = emailLines.join('\r\n');
      const encodedEmail = Buffer.from(emailString)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      this.logger.log(`Email sent successfully for user ${userId}, message ID: ${response.data.id}`);

      return { messageId: response.data.id! };
    } catch (error) {
      this.logger.error(`Failed to send email for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Search emails with Gmail query syntax
   */
  async searchEmails(userId: string, query: string, maxResults: number = 20): Promise<GmailMessage[]> {
    try {
      const searchResults = await this.getMessages(userId, {
        query,
        maxResults,
      });

      this.logger.log(`Search found ${searchResults.messages.length} messages for user: ${userId}`);
      return searchResults.messages;
    } catch (error) {
      this.logger.error(`Failed to search emails for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get unread emails
   */
  async getUnreadEmails(userId: string, maxResults: number = 50): Promise<GmailMessage[]> {
    return this.searchEmails(userId, 'is:unread', maxResults);
  }

  /**
   * Get emails from specific sender
   */
  async getEmailsFromSender(userId: string, senderEmail: string, maxResults: number = 20): Promise<GmailMessage[]> {
    return this.searchEmails(userId, `from:${senderEmail}`, maxResults);
  }

  /**
   * Mark message as read
   */
  async markAsRead(userId: string, messageId: string): Promise<void> {
    try {
      const client = await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: 'v1', auth: client });

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });

      this.logger.log(`Marked message ${messageId} as read for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to mark message as read for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's Gmail profile
   */
  async getProfile(userId: string): Promise<{ emailAddress: string; historyId: string; messagesTotal: number; threadsTotal: number }> {
    try {
      const client = await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: 'v1', auth: client });

      const response = await gmail.users.getProfile({
        userId: 'me',
      });

      return {
        emailAddress: response.data.emailAddress!,
        historyId: response.data.historyId!,
        messagesTotal: response.data.messagesTotal || 0,
        threadsTotal: response.data.threadsTotal || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get Gmail profile for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create a draft email
   */
  async createDraft(userId: string, emailParams: GmailSendEmailParams): Promise<{ draftId: string }> {
    try {
      const client = await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: 'v1', auth: client });

      // Create email message (same as send but for draft)
      const emailLines: string[] = [];
      emailLines.push(`To: ${Array.isArray(emailParams.to) ? emailParams.to.join(', ') : emailParams.to}`);
      emailLines.push(`Subject: ${emailParams.subject}`);
      
      if (emailParams.htmlBody) {
        emailLines.push('Content-Type: text/html; charset=utf-8');
        emailLines.push('');
        emailLines.push(emailParams.htmlBody);
      } else {
        emailLines.push('Content-Type: text/plain; charset=utf-8');
        emailLines.push('');
        emailLines.push(emailParams.textBody || '');
      }

      const emailString = emailLines.join('\r\n');
      const encodedEmail = Buffer.from(emailString)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Create draft
      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedEmail,
          },
        },
      });

      this.logger.log(`Draft created for user ${userId}, draft ID: ${response.data.id}`);

      return { draftId: response.data.id! };
    } catch (error) {
      this.logger.error(`Failed to create draft for user ${userId}:`, error);
      throw error;
    }
  }
} 
import { EmailAddress } from './email-address.model';
import { EmailAttachment } from './email-attachment.model';

export class Email {
  id: string;
  threadId?: string;
  conversationId?: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress[];
  date: string;
  receivedDate?: string;
  body: string;
  htmlBody?: string;
  snippet?: string;
  isRead?: boolean;
  isStarred?: boolean;
  isImportant?: boolean;
  isDraft?: boolean;
  labels?: string[];
  folders?: string[];
  attachments?: EmailAttachment[];
  references?: string[];
  inReplyTo?: string;
  metadata?: Record<string, any>;
  
  constructor(data: Partial<Email>) {
    this.id = data.id || '';
    this.threadId = data.threadId;
    this.conversationId = data.conversationId || data.threadId;
    this.subject = data.subject || '';
    
    // Handle email addresses
    this.from = data.from instanceof EmailAddress 
      ? data.from 
      : new EmailAddress(data.from || { address: '' });
    
    this.to = Array.isArray(data.to) 
      ? data.to.map(to => to instanceof EmailAddress ? to : new EmailAddress(to)) 
      : [];
    
    if (data.cc) {
      this.cc = Array.isArray(data.cc) 
        ? data.cc.map(cc => cc instanceof EmailAddress ? cc : new EmailAddress(cc)) 
        : [];
    }
    
    if (data.bcc) {
      this.bcc = Array.isArray(data.bcc) 
        ? data.bcc.map(bcc => bcc instanceof EmailAddress ? bcc : new EmailAddress(bcc)) 
        : [];
    }
    
    if (data.replyTo) {
      this.replyTo = Array.isArray(data.replyTo) 
        ? data.replyTo.map(rt => rt instanceof EmailAddress ? rt : new EmailAddress(rt)) 
        : [];
    }
    
    // Set dates
    this.date = data.date || new Date().toISOString();
    this.receivedDate = data.receivedDate;
    
    // Set content
    this.body = data.body || '';
    this.htmlBody = data.htmlBody;
    this.snippet = data.snippet || this.body.substring(0, 100);
    
    // Set flags
    this.isRead = data.isRead;
    this.isStarred = data.isStarred;
    this.isImportant = data.isImportant;
    this.isDraft = data.isDraft;
    
    // Set organization
    this.labels = data.labels;
    this.folders = data.folders;
    
    // Set attachments
    if (data.attachments) {
      this.attachments = Array.isArray(data.attachments) 
        ? data.attachments.map(att => att instanceof EmailAttachment ? att : new EmailAttachment(att)) 
        : [];
    }
    
    // Set threading
    this.references = data.references;
    this.inReplyTo = data.inReplyTo;
    
    // Set metadata
    this.metadata = data.metadata || {};
  }
  
  /**
   * Get all recipients (to, cc, bcc)
   */
  getAllRecipients(): EmailAddress[] {
    const recipients = [...this.to];
    
    if (this.cc) {
      recipients.push(...this.cc);
    }
    
    if (this.bcc) {
      recipients.push(...this.bcc);
    }
    
    return recipients;
  }
  
  /**
   * Check if the email has attachments
   */
  hasAttachments(): boolean {
    return !!(this.attachments && this.attachments.length > 0);
  }
  
  /**
   * Get the total size of all attachments
   */
  getAttachmentsSize(): number {
    if (!this.attachments) return 0;
    
    return this.attachments.reduce((total, attachment) => total + attachment.size, 0);
  }
  
  /**
   * Check if the email is part of a thread
   */
  isThreaded(): boolean {
    return !!(this.threadId || this.inReplyTo || (this.references && this.references.length > 0));
  }
  
  /**
   * Add a label to the email
   */
  addLabel(label: string): void {
    if (!this.labels) {
      this.labels = [];
    }
    
    if (!this.labels.includes(label)) {
      this.labels.push(label);
    }
  }
  
  /**
   * Remove a label from the email
   */
  removeLabel(label: string): void {
    if (!this.labels) return;
    
    this.labels = this.labels.filter(l => l !== label);
  }
} 
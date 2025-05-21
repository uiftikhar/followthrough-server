import { Email } from './email.model';
import { EmailAddress } from './email-address.model';

export class Thread {
  id: string;
  subject: string;
  emails: Email[];
  participants?: EmailAddress[];
  lastMessageDate?: string;
  isRead?: boolean;
  isImportant?: boolean;
  labels?: string[];
  metadata?: Record<string, any>;
  
  constructor(data: Partial<Thread>) {
    this.id = data.id || '';
    this.subject = data.subject || '';
    
    // Set emails
    this.emails = Array.isArray(data.emails) 
      ? data.emails.map(email => email instanceof Email ? email : new Email(email)) 
      : [];
    
    // Set participants
    if (data.participants) {
      this.participants = Array.isArray(data.participants) 
        ? data.participants.map(p => p instanceof EmailAddress ? p : new EmailAddress(p)) 
        : [];
    } else {
      // Extract participants from emails
      this.extractParticipants();
    }
    
    // Set dates and flags
    this.lastMessageDate = data.lastMessageDate || this.getLastMessageDate();
    this.isRead = data.isRead;
    this.isImportant = data.isImportant;
    
    // Set organization
    this.labels = data.labels;
    
    // Set metadata
    this.metadata = data.metadata || {};
  }
  
  /**
   * Extract participants from all emails in the thread
   */
  private extractParticipants(): void {
    const participantMap = new Map<string, EmailAddress>();
    
    for (const email of this.emails) {
      // Add sender
      participantMap.set(email.from.address, email.from);
      
      // Add recipients
      for (const recipient of email.getAllRecipients()) {
        participantMap.set(recipient.address, recipient);
      }
    }
    
    this.participants = Array.from(participantMap.values());
  }
  
  /**
   * Get the date of the last message in the thread
   */
  private getLastMessageDate(): string {
    if (!this.emails.length) return '';
    
    // Sort emails by date
    const sortedEmails = [...this.emails].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
    
    return sortedEmails[0].date;
  }
  
  /**
   * Get the number of messages in the thread
   */
  getMessageCount(): number {
    return this.emails.length;
  }
  
  /**
   * Add an email to the thread
   */
  addEmail(email: Email): void {
    // Check if the email is already in the thread
    const existingIndex = this.emails.findIndex(e => e.id === email.id);
    
    if (existingIndex >= 0) {
      // Replace the existing email
      this.emails[existingIndex] = email;
    } else {
      // Add the new email
      this.emails.push(email);
      
      // Add new participants
      this.extractParticipants();
    }
    
    // Update the last message date
    this.lastMessageDate = this.getLastMessageDate();
  }
  
  /**
   * Check if all messages in the thread are read
   */
  isFullyRead(): boolean {
    return this.emails.every(email => email.isRead);
  }
  
  /**
   * Get the first email in the thread (chronologically)
   */
  getFirstEmail(): Email | null {
    if (!this.emails.length) return null;
    
    // Sort emails by date
    const sortedEmails = [...this.emails].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB; // Ascending order (oldest first)
    });
    
    return sortedEmails[0];
  }
  
  /**
   * Get the most recent email in the thread
   */
  getLastEmail(): Email | null {
    if (!this.emails.length) return null;
    
    // Sort emails by date
    const sortedEmails = [...this.emails].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
    
    return sortedEmails[0];
  }
} 
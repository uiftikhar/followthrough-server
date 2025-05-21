export class EmailAddress {
  name: string;
  address: string;
  
  constructor(data: Partial<EmailAddress>) {
    this.name = data.name || '';
    this.address = data.address || '';
  }
  
  static fromString(emailString: string): EmailAddress {
    // Parse email format like: "John Doe <john@example.com>"
    const matches = emailString.match(/^(?:"?([^"]*)"?\s)?<?([^>]*)>?$/);
    
    if (matches && matches.length >= 3) {
      return new EmailAddress({
        name: matches[1]?.trim() || '',
        address: matches[2].trim(),
      });
    }
    
    // If no match, assume the whole string is the email address
    return new EmailAddress({
      address: emailString.trim(),
    });
  }
  
  toString(): string {
    if (this.name) {
      return `${this.name} <${this.address}>`;
    }
    return this.address;
  }
} 
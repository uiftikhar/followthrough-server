export class EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  content?: Buffer | string;
  url?: string;
  
  constructor(data: Partial<EmailAttachment>) {
    this.id = data.id || '';
    this.filename = data.filename || '';
    this.contentType = data.contentType || 'application/octet-stream';
    this.size = data.size || 0;
    this.content = data.content;
    this.url = data.url;
  }
  
  /**
   * Checks if the attachment content is available in memory
   */
  hasContent(): boolean {
    return !!this.content;
  }
  
  /**
   * Checks if the attachment is an image
   */
  isImage(): boolean {
    return this.contentType.startsWith('image/');
  }
  
  /**
   * Checks if the attachment is a PDF
   */
  isPdf(): boolean {
    return this.contentType === 'application/pdf';
  }
  
  /**
   * Gets the file extension based on the content type
   */
  getExtension(): string {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'text/html': 'html',
      'application/json': 'json',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    };
    
    return extensionMap[this.contentType] || 'bin';
  }
} 
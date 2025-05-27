import { apiClient } from './apiClient';

export interface ZapTemplate {
  id: string;
  title: string;
  description: string;
  trigger: string;
  action: string;
  zapierUrl: string;
  embedUrl: string;
  category: 'email' | 'calendar' | 'automation';
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  estimatedTime: string;
}

export interface ConnectedZap {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error';
  trigger: string;
  action: string;
  lastRun: string;
  totalRuns: number;
  successRate: number;
}

export interface ZapierApiKey {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

class ZapierService {
  private baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  /**
   * Generate a new Zapier API key
   */
  async generateApiKey(name: string = 'Zapier Integration'): Promise<ZapierApiKey> {
    try {
      const response = await apiClient.post('/api/zapier/api-key', { name });
      return response.data;
    } catch (error) {
      console.error('Failed to generate Zapier API key:', error);
      throw new Error('Failed to generate API key');
    }
  }

  /**
   * Get all Zapier API keys for the user
   */
  async getApiKeys(): Promise<ZapierApiKey[]> {
    try {
      const response = await apiClient.get('/api/zapier/api-keys');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      throw new Error('Failed to fetch API keys');
    }
  }

  /**
   * Revoke a Zapier API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/zapier/api-key/${keyId}`);
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      throw new Error('Failed to revoke API key');
    }
  }

  /**
   * Get predefined Zap templates
   */
  getZapTemplates(): ZapTemplate[] {
    return [
      {
        id: 'email-triage',
        title: 'Automated Email Triage',
        description: 'Automatically analyze and categorize incoming support emails with AI-powered insights',
        trigger: 'Gmail: New Email',
        action: 'FollowThrough AI: Trigger Email Triage',
        zapierUrl: this.buildZapierUrl('email-triage'),
        embedUrl: this.buildEmbedUrl('email-triage'),
        category: 'email',
        difficulty: 'Easy',
        estimatedTime: '5 min'
      },
      {
        id: 'daily-brief',
        title: 'Daily Email Brief',
        description: 'Get a daily AI-generated summary of unread emails with priorities and action items',
        trigger: 'Schedule: Every Day',
        action: 'FollowThrough AI: Find Emails + Draft Reply',
        zapierUrl: this.buildZapierUrl('daily-brief'),
        embedUrl: this.buildEmbedUrl('daily-brief'),
        category: 'email',
        difficulty: 'Medium',
        estimatedTime: '10 min'
      },
      {
        id: 'meeting-analysis',
        title: 'Meeting Follow-up Automation',
        description: 'Automatically analyze calendar events and generate follow-up tasks and summaries',
        trigger: 'Google Calendar: New Event',
        action: 'FollowThrough AI: Trigger Meeting Analysis',
        zapierUrl: this.buildZapierUrl('meeting-analysis'),
        embedUrl: this.buildEmbedUrl('meeting-analysis'),
        category: 'calendar',
        difficulty: 'Medium',
        estimatedTime: '8 min'
      },
      {
        id: 'task-extraction',
        title: 'Email to Task Automation',
        description: 'Extract actionable tasks from emails and create them in your project management tool',
        trigger: 'Gmail: Email Matching Search',
        action: 'FollowThrough AI: Create Task From Email',
        zapierUrl: this.buildZapierUrl('task-extraction'),
        embedUrl: this.buildEmbedUrl('task-extraction'),
        category: 'automation',
        difficulty: 'Advanced',
        estimatedTime: '15 min'
      }
    ];
  }

  /**
   * Get connected Zaps (mock data for now - would integrate with Zapier API)
   */
  async getConnectedZaps(): Promise<ConnectedZap[]> {
    // This would integrate with Zapier's API to get actual connected Zaps
    // For now, returning mock data
    return [
      {
        id: 'zap-1',
        name: 'Email Triage Automation',
        status: 'active',
        trigger: 'Gmail: New Email',
        action: 'FollowThrough AI: Trigger Email Triage',
        lastRun: '2024-01-15T10:30:00Z',
        totalRuns: 156,
        successRate: 98.7
      },
      {
        id: 'zap-2',
        name: 'Daily Email Brief',
        status: 'active',
        trigger: 'Schedule: Every Day',
        action: 'FollowThrough AI: Find Emails',
        lastRun: '2024-01-15T08:00:00Z',
        totalRuns: 30,
        successRate: 100
      }
    ];
  }

  /**
   * Test Zapier connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.get('/api/zapier/test');
      return {
        success: true,
        message: 'Connection successful'
      };
    } catch (error) {
      console.error('Zapier connection test failed:', error);
      return {
        success: false,
        message: 'Connection failed. Please check your API key.'
      };
    }
  }

  /**
   * Build Zapier template URL
   */
  private buildZapierUrl(templateId: string): string {
    const baseUrl = 'https://zapier.com/app/editor/template';
    // In production, these would be actual Zapier template IDs
    const templateIds: Record<string, string> = {
      'email-triage': 'followthrough-email-triage-123',
      'daily-brief': 'followthrough-daily-brief-456',
      'meeting-analysis': 'followthrough-meeting-analysis-789',
      'task-extraction': 'followthrough-task-extraction-012'
    };
    
    return `${baseUrl}/${templateIds[templateId] || templateId}`;
  }

  /**
   * Build Zapier embed URL
   */
  private buildEmbedUrl(templateId: string): string {
    const baseUrl = 'https://zapier.com/partner/embed';
    const templateIds: Record<string, string> = {
      'email-triage': 'followthrough-email-triage-123',
      'daily-brief': 'followthrough-daily-brief-456',
      'meeting-analysis': 'followthrough-meeting-analysis-789',
      'task-extraction': 'followthrough-task-extraction-012'
    };
    
    return `${baseUrl}/${templateIds[templateId] || templateId}`;
  }

  /**
   * Create a custom Zap URL with pre-filled data
   */
  createCustomZapUrl(trigger: string, action: string): string {
    const params = new URLSearchParams({
      trigger_app: trigger,
      action_app: 'followthrough-ai-integration'
    });
    
    return `https://zapier.com/app/editor?${params.toString()}`;
  }

  /**
   * Generate Zapier webhook URL for testing
   */
  generateWebhookUrl(endpoint: string): string {
    return `${this.baseUrl}/api/zapier/webhooks/${endpoint}`;
  }
}

export const zapierService = new ZapierService(); 
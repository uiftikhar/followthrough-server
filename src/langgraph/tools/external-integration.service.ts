import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export type IntegrationType = 'jira' | 'asana' | 'slack' | 'github';

interface ExternalToolConfig {
  enabled: boolean;
  apiKey?: string;
  apiUrl?: string;
  projectId?: string;
  useTestMode?: boolean;
}

@Injectable()
export class ExternalIntegrationService {
  private readonly logger = new Logger(ExternalIntegrationService.name);
  private readonly toolConfigs: Record<IntegrationType, ExternalToolConfig>;
  private readonly testMode: boolean;

  constructor(private readonly configService: ConfigService) {
    // Load configuration for external tools
    this.toolConfigs = {
      jira: this.loadToolConfig('jira'),
      asana: this.loadToolConfig('asana'),
      slack: this.loadToolConfig('slack'),
      github: this.loadToolConfig('github'),
    };

    // Determine if we're running in test mode
    this.testMode = configService.get<boolean>('testing.enabled') || false;

    if (this.testMode) {
      this.logger.warn(
        'External integrations running in TEST MODE - no real API calls will be made',
      );
    }
  }

  /**
   * Load configuration for a specific tool
   */
  private loadToolConfig(toolName: string): ExternalToolConfig {
    const config = this.configService.get<ExternalToolConfig>(
      `tools.${toolName}`,
    ) || {
      enabled: false,
    };

    // If test mode is enabled globally, override individual tool settings
    if (this.testMode) {
      config.useTestMode = true;
    }

    return config;
  }

  /**
   * Create a Jira ticket creation tool
   */
  createJiraTicketTool() {
    return tool(
      async ({ summary, description, project, issueType, priority }) => {
        this.logger.log(`Creating Jira ticket: ${summary}`);

        if (this.testMode || this.toolConfigs.jira.useTestMode) {
          // Mock response in test mode
          return JSON.stringify({
            id: `MOCK-${Math.floor(Math.random() * 1000)}`,
            key: `PROJECT-${Math.floor(Math.random() * 1000)}`,
            summary,
            description,
            status: 'Created',
            _testMode: true,
          });
        }

        // Real implementation would call Jira API here
        try {
          // TODO: Implement real Jira API call
          throw new Error('Real Jira API not implemented yet');
        } catch (error) {
          this.logger.error(`Error creating Jira ticket: ${error.message}`);
          throw error;
        }
      },
      {
        name: 'create_jira_ticket',
        description: 'Create a new ticket in Jira',
        schema: z.object({
          summary: z.string().describe('The summary of the Jira ticket'),
          description: z
            .string()
            .describe('A detailed description of the ticket'),
          project: z.string().optional().describe('The project key'),
          issueType: z
            .string()
            .optional()
            .default('Task')
            .describe('Type of issue (Bug, Task, etc.)'),
          priority: z
            .string()
            .optional()
            .default('Medium')
            .describe('Ticket priority'),
        }),
      },
    );
  }

  /**
   * Create an Asana task creation tool
   */
  createAsanaTaskTool() {
    return tool(
      async ({ name, notes, projectId, assignee, dueDate }) => {
        this.logger.log(`Creating Asana task: ${name}`);

        if (this.testMode || this.toolConfigs.asana.useTestMode) {
          // Mock response in test mode
          return JSON.stringify({
            id: `MOCK-${Math.floor(Math.random() * 1000)}`,
            name,
            notes,
            status: 'Created',
            _testMode: true,
          });
        }

        // Real implementation would call Asana API here
        try {
          // TODO: Implement real Asana API call
          throw new Error('Real Asana API not implemented yet');
        } catch (error) {
          this.logger.error(`Error creating Asana task: ${error.message}`);
          throw error;
        }
      },
      {
        name: 'create_asana_task',
        description: 'Create a new task in Asana',
        schema: z.object({
          name: z.string().describe('The name of the Asana task'),
          notes: z.string().describe('A detailed description of the task'),
          projectId: z.string().optional().describe('The project ID'),
          assignee: z.string().optional().describe('Email of the assignee'),
          dueDate: z.string().optional().describe('Due date in ISO format'),
        }),
      },
    );
  }

  /**
   * Create a Slack message tool
   */
  createSlackMessageTool() {
    return tool(
      async ({ channel, message, attachments }) => {
        this.logger.log(`Sending Slack message to ${channel}`);

        if (this.testMode || this.toolConfigs.slack.useTestMode) {
          // Mock response in test mode
          return JSON.stringify({
            id: `MOCK-${Math.floor(Math.random() * 1000)}`,
            channel,
            message:
              message.substring(0, 20) + (message.length > 20 ? '...' : ''),
            status: 'Sent',
            timestamp: new Date().toISOString(),
            _testMode: true,
          });
        }

        // Real implementation would call Slack API here
        try {
          // TODO: Implement real Slack API call
          throw new Error('Real Slack API not implemented yet');
        } catch (error) {
          this.logger.error(`Error sending Slack message: ${error.message}`);
          throw error;
        }
      },
      {
        name: 'send_slack_message',
        description: 'Send a message to a Slack channel',
        schema: z.object({
          channel: z
            .string()
            .describe('The channel or user to send the message to'),
          message: z.string().describe('The message text to send'),
          attachments: z
            .array(z.any())
            .optional()
            .describe('Optional attachments'),
        }),
      },
    );
  }

  /**
   * Get all available external tools
   */
  getAllTools() {
    const tools: any[] = [];

    if (this.toolConfigs.jira.enabled) {
      tools.push(this.createJiraTicketTool());
    }

    if (this.toolConfigs.asana.enabled) {
      tools.push(this.createAsanaTaskTool());
    }

    if (this.toolConfigs.slack.enabled) {
      tools.push(this.createSlackMessageTool());
    }

    return tools;
  }
}

# Email Management & Triage System

This document provides an overview of the Email Management & Triage System implementation for FollowThrough AI.

## System Architecture

The Email Management & Triage System consists of several components:

1. **MCP Integration Layer**: Connects to external services via the Model Context Protocol
2. **Email Processing System**: Handles email fetching, analysis, and organization
3. **Task Management Integration**: Extracts and tracks tasks from emails
4. **Approval Workflow**: Manages task approvals for extracted tasks

## Getting Started

### Configuration

To use the system, first configure the necessary environment variables:

```
# MCP Server Configuration
GMAIL_MCP_SERVER=https://your-gmail-mcp-server.com
OUTLOOK_MCP_SERVER=https://your-outlook-mcp-server.com
JIRA_MCP_SERVER=https://your-jira-mcp-server.com
ASANA_MCP_SERVER=https://your-asana-mcp-server.com
TRELLO_MCP_SERVER=https://your-trello-mcp-server.com
ZAPIER_MCP_SERVER=https://your-zapier-mcp-server.com

# Notification Settings
NOTIFICATIONS_EMAIL_ENABLED=true
NOTIFICATIONS_PUSH_ENABLED=false
NOTIFICATIONS_SLACK_ENABLED=false
```

### API Endpoints

#### Email Management

- `GET /api/email/:provider/messages` - Get emails from a provider
- `GET /api/email/:provider/messages/:id` - Get a specific email
- `GET /api/email/:provider/threads/:id` - Get a specific email thread
- `POST /api/email/:provider/send` - Send an email
- `PATCH /api/email/:provider/messages/:id/metadata` - Update email metadata

#### Task Management

- `GET /api/tasks/:platform` - Get tasks from a task platform
- `GET /api/tasks/:platform/:id` - Get a specific task
- `POST /api/tasks/:platform` - Create a task
- `PATCH /api/tasks/:platform/:id` - Update a task
- `POST /api/tasks/extract-from-email` - Extract tasks from an email

#### Approval Workflow

- `GET /api/approvals` - Get pending approvals
- `GET /api/approvals/:id` - Get a specific approval request
- `POST /api/approvals/:id/approve` - Approve a task
- `POST /api/approvals/:id/reject` - Reject a task

## Email to Task Extraction

The system can automatically extract tasks from emails using two methods:

1. **Rule-based extraction**: Identifies tasks based on patterns and keywords
2. **LLM-based extraction**: Uses a language model to identify implied tasks

When extracting tasks, the system:
- Analyzes email content for actionable items
- Sets appropriate priorities and deadlines
- Enriches task metadata with context
- Submits tasks for approval when needed

## Components Overview

### Email Service

Manages email operations through provider-specific connectors:
- Gmail Connector
- Outlook Connector

### Task Service

Manages task operations across multiple task platforms:
- Jira, Asana, Trello integrations
- Task extraction and enrichment

### Notifications Service

Manages user notifications through multiple channels:
- Email
- Push notifications (when enabled)
- Slack (when enabled)

## Example: Extracting Tasks from Email

```typescript
// Example usage in a controller
@Post('extract-from-email')
async extractTasksFromEmail(@Body() data: { userId: string, provider: string, emailId: string }) {
  const { userId, provider, emailId } = data;
  
  // Get the email
  const email = await this.emailService.getEmail(userId, provider, emailId);
  
  // Extract tasks
  const tasks = await this.emailTaskExtractor.extractTasks(email);
  
  // Process tasks (e.g., create approval requests)
  const approvalPromises = tasks.map(task => 
    this.approvalWorkflow.createApprovalRequest(userId, task)
  );
  
  const approvalRequests = await Promise.all(approvalPromises);
  
  return { tasks, approvalRequests };
}
```

## Next Steps

After Phase 1, future enhancements will include:
- Email triage automation
- Smart response suggestions
- Email delegation and follow-up workflows
- Integration with more email providers and task platforms

See `implementation-phase-2.md` for details on upcoming features.
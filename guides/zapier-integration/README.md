# Zapier Integration Guide

This guide explains how to connect your FollowThrough AI application with Zapier.

## Overview

The integration allows you to:
1. Send data from your app to other apps via Zapier
2. Receive data from other apps to your app via Zapier
3. Automate workflows between your app and 5000+ applications

## Prerequisites

- Zapier account (free or paid)
- API key from your FollowThrough AI application

## Step 1: Set Up Your Zapier Developer Account

1. Go to [Zapier Developer Platform](https://developer.zapier.com/) and sign in
2. Create a new integration by clicking "Start a New Integration"
3. Fill in the basic details:
   - Name: FollowThrough AI
   - Description: Connect FollowThrough AI with thousands of apps to automate your workflow
   - Category: Productivity
   - Role: Creator

## Step 2: Configure Authentication

Set up the authentication:

1. Choose "API Key" as the authentication type
2. Set up the following fields:
   - Key Name: API Key
   - Key Location: Header
   - Header Key Name: x-api-key
3. Add API Key Instructions:
   ```
   To get your API key:
   1. Log in to your FollowThrough AI account
   2. Go to Settings > Integrations > Zapier
   3. Click "Generate API Key"
   4. Copy the generated key
   ```
4. Test Authentication URL: `https://your-api-domain.com/api/zapier/test`

## Step 3: Define Triggers

### Trigger: New Task

1. Create a new trigger with these settings:
   - Key: new_task
   - Name: New Task
   - Noun: Task
   - Description: Triggers when a new task is created
2. API Configuration:
   - Endpoint: `https://your-api-domain.com/api/zapier/triggers/tasks`
   - Method: GET
   - Response Type: JSON
3. Define sample data:
   ```json
   {
     "id": "task-123",
     "title": "Complete project proposal",
     "description": "Create a detailed proposal for the new client project",
     "dueDate": "2023-12-01",
     "assignee": "user-456",
     "priority": "high",
     "status": "open",
     "createdAt": "2023-11-15T10:30:00Z"
   }
   ```

### Trigger: New Meeting

1. Create a new trigger with these settings:
   - Key: new_meeting
   - Name: New Meeting
   - Noun: Meeting
   - Description: Triggers when a new meeting is scheduled
2. API Configuration:
   - Endpoint: `https://your-api-domain.com/api/zapier/triggers/meetings`
   - Method: GET
   - Response Type: JSON
3. Define sample data:
   ```json
   {
     "id": "meeting-789",
     "title": "Project Kickoff",
     "description": "Initial meeting to discuss project scope and timeline",
     "startTime": "2023-12-05T14:00:00Z",
     "endTime": "2023-12-05T15:00:00Z",
     "location": "Virtual - Zoom",
     "attendees": [
       {"name": "Jane Doe", "email": "jane@example.com"},
       {"name": "John Smith", "email": "john@example.com"}
     ],
     "createdAt": "2023-11-28T09:15:00Z"
   }
   ```

## Step 4: Define Actions

### Action: Create Task

1. Create a new action with these settings:
   - Key: create_task
   - Name: Create Task
   - Description: Creates a new task in FollowThrough AI
2. API Configuration:
   - Endpoint: `https://your-api-domain.com/api/zapier/webhooks/task`
   - Method: POST
   - Request Type: JSON
   - Response Type: JSON
3. Input Fields:
   - `title` (required): Task title
   - `description`: Task description
   - `dueDate`: Due date (YYYY-MM-DD)
   - `assignee`: User ID or email
   - `priority`: Task priority (low, medium, high)
4. Response Fields:
   - `status`: Operation status
   - `message`: Message about the operation
   - `taskId`: ID of the created task

### Action: Schedule Meeting

1. Create a new action with these settings:
   - Key: schedule_meeting
   - Name: Schedule Meeting
   - Description: Schedules a new meeting in FollowThrough AI
2. API Configuration:
   - Endpoint: `https://your-api-domain.com/api/zapier/webhooks/meeting`
   - Method: POST
   - Request Type: JSON
   - Response Type: JSON
3. Input Fields:
   - `title` (required): Meeting title
   - `description`: Meeting description
   - `startTime` (required): Start time (ISO format)
   - `endTime` (required): End time (ISO format)
   - `location`: Meeting location
   - `attendees`: List of attendees with name and email
4. Response Fields:
   - `status`: Operation status
   - `message`: Message about the operation
   - `meetingId`: ID of the scheduled meeting

## Step 5: Testing and Deployment

1. Test all triggers and actions
2. Submit for review
3. Once approved, your integration will be available in the Zapier marketplace

## Step 6: User Documentation

Create user documentation to help your users set up Zaps:

1. How to authenticate with your app
2. Example Zaps they can create
3. Common troubleshooting tips

## Support

For any questions or issues with the Zapier integration, contact our support team at support@followthroughai.com 
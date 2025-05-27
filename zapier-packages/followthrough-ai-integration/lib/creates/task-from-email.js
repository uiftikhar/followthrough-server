"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_1 = require("../utils/api-client");
const perform = async (z, bundle) => {
    const inputData = bundle.inputData;
    const { emailId, emailSubject, emailFrom, emailBody, assignee, defaultPriority, dueDate, projectContext, customInstructions } = inputData;
    if (!emailId || !emailSubject || !emailBody) {
        throw new Error('Email ID, subject, and body are required for task extraction');
    }
    const apiClient = new api_client_1.ApiClient(z, bundle);
    try {
        // Extract tasks from email through the FollowThrough AI server
        const response = await apiClient.post('/api/zapier/extract-tasks', {
            emailId,
            emailSubject,
            emailFrom,
            emailBody,
            assignee,
            defaultPriority: defaultPriority || 'medium',
            dueDate,
            projectContext,
            customInstructions,
            source: 'zapier',
            timestamp: new Date().toISOString(),
        });
        const taskData = response.data.tasks?.[0] || response.data; // Handle single task or array
        return {
            taskId: taskData.taskId || `task_${Date.now()}`,
            title: taskData.title || `Task from: ${emailSubject}`,
            description: taskData.description || '',
            priority: taskData.priority || defaultPriority || 'medium',
            dueDate: taskData.dueDate || dueDate,
            assignee: taskData.assignee || assignee,
            category: taskData.category || 'email-derived',
            estimatedTime: taskData.estimatedTime,
            dependencies: taskData.dependencies || [],
            tags: taskData.tags || ['email', 'auto-generated'],
            sourceEmail: {
                id: emailId,
                subject: emailSubject,
                from: emailFrom,
            },
            confidence: taskData.confidence || 0.8,
            success: true,
        };
    }
    catch (error) {
        z.console.error('Task extraction failed:', error);
        throw new Error(`Failed to extract task from email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
exports.default = {
    key: 'taskFromEmail',
    noun: 'Task',
    display: {
        label: 'Create Task From Email',
        description: 'Extract actionable tasks from emails using FollowThrough AI',
    },
    operation: {
        inputFields: [
            {
                key: 'emailId',
                label: 'Email ID',
                type: 'string',
                required: true,
                helpText: 'The unique identifier of the source email',
            },
            {
                key: 'emailSubject',
                label: 'Email Subject',
                type: 'string',
                required: true,
                helpText: 'Subject line of the source email',
            },
            {
                key: 'emailFrom',
                label: 'Email Sender',
                type: 'string',
                required: true,
                helpText: 'Email address of the sender',
            },
            {
                key: 'emailBody',
                label: 'Email Body',
                type: 'text',
                required: true,
                helpText: 'Content of the email to extract tasks from',
            },
            {
                key: 'assignee',
                label: 'Default Assignee',
                type: 'string',
                required: false,
                helpText: 'Default person to assign the task to (if not specified in email)',
            },
            {
                key: 'defaultPriority',
                label: 'Default Priority',
                type: 'string',
                required: false,
                choices: ['low', 'medium', 'high', 'urgent'],
                default: 'medium',
                helpText: 'Default priority level for extracted tasks',
            },
            {
                key: 'dueDate',
                label: 'Default Due Date',
                type: 'datetime',
                required: false,
                helpText: 'Default due date if not specified in email',
            },
            {
                key: 'projectContext',
                label: 'Project Context',
                type: 'string',
                required: false,
                helpText: 'Project or context to associate the task with',
            },
            {
                key: 'customInstructions',
                label: 'Custom Instructions',
                type: 'text',
                required: false,
                helpText: 'Additional instructions for task extraction (e.g., specific formats, requirements)',
            },
        ],
        outputFields: [
            { key: 'taskId', label: 'Task ID', type: 'string' },
            { key: 'title', label: 'Task Title', type: 'string' },
            { key: 'description', label: 'Task Description', type: 'string' },
            { key: 'priority', label: 'Priority', type: 'string' },
            { key: 'dueDate', label: 'Due Date', type: 'datetime' },
            { key: 'assignee', label: 'Assignee', type: 'string' },
            { key: 'category', label: 'Category', type: 'string' },
            { key: 'estimatedTime', label: 'Estimated Time (minutes)', type: 'integer' },
            { key: 'dependencies', label: 'Dependencies', type: 'string', list: true },
            { key: 'tags', label: 'Tags', type: 'string', list: true },
            { key: 'sourceEmail__id', label: 'Source Email ID', type: 'string' },
            { key: 'sourceEmail__subject', label: 'Source Email Subject', type: 'string' },
            { key: 'sourceEmail__from', label: 'Source Email From', type: 'string' },
            { key: 'confidence', label: 'Confidence Score', type: 'number' },
            { key: 'success', label: 'Success', type: 'boolean' },
        ],
        perform,
        sample: {
            taskId: 'task_1234567890',
            title: 'Review and approve Q1 budget proposal',
            description: 'Review the Q1 budget proposal sent by the finance team. Focus on marketing and development allocations. Provide feedback by Friday.',
            priority: 'high',
            dueDate: '2024-01-19T17:00:00Z',
            assignee: 'manager@company.com',
            category: 'budget-review',
            estimatedTime: 120,
            dependencies: ['Finance team budget completion'],
            tags: ['budget', 'q1', 'review', 'email', 'auto-generated'],
            sourceEmail: {
                id: 'email-123456789',
                subject: 'Q1 Budget Proposal - Review Required',
                from: 'finance@company.com',
            },
            confidence: 0.89,
            success: true,
        },
    },
};
//# sourceMappingURL=task-from-email.js.map
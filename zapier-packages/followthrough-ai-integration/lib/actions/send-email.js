"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const google_client_1 = require("../utils/google-client");
const perform = async (z, bundle) => {
    const inputData = bundle.inputData;
    const { to, subject, body, isHtml, inReplyTo, references, cc, bcc } = inputData;
    if (!to || !subject || !body) {
        throw new Error('To, subject, and body are required for sending email');
    }
    const googleClient = new google_client_1.GoogleClient(z, bundle);
    try {
        const emailData = {
            to,
            subject,
            body,
            isHtml: isHtml || false,
            inReplyTo,
            references,
            cc,
            bcc,
        };
        const result = await googleClient.sendEmail(emailData);
        return {
            id: result.id,
            threadId: result.threadId,
            labelIds: result.labelIds,
            snippet: result.snippet,
            success: true,
        };
    }
    catch (error) {
        z.console.error('Failed to send email:', error);
        throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
exports.default = {
    key: 'sendEmail',
    noun: 'Email',
    display: {
        label: 'Send Email',
        description: 'Send an email via Gmail using your authenticated Google account',
    },
    operation: {
        inputFields: [
            {
                key: 'to',
                label: 'To',
                type: 'string',
                required: true,
                helpText: 'Email address of the recipient',
            },
            {
                key: 'subject',
                label: 'Subject',
                type: 'string',
                required: true,
                helpText: 'Subject line of the email',
            },
            {
                key: 'body',
                label: 'Body',
                type: 'text',
                required: true,
                helpText: 'Content of the email',
            },
            {
                key: 'isHtml',
                label: 'Is HTML',
                type: 'boolean',
                required: false,
                default: 'false',
                helpText: 'Whether the email body contains HTML formatting',
            },
            {
                key: 'cc',
                label: 'CC',
                type: 'string',
                required: false,
                helpText: 'CC recipients (comma-separated)',
            },
            {
                key: 'bcc',
                label: 'BCC',
                type: 'string',
                required: false,
                helpText: 'BCC recipients (comma-separated)',
            },
            {
                key: 'inReplyTo',
                label: 'In Reply To',
                type: 'string',
                required: false,
                helpText: 'Message ID this email is replying to',
            },
            {
                key: 'references',
                label: 'References',
                type: 'string',
                required: false,
                helpText: 'References header for email threading',
            },
        ],
        outputFields: [
            { key: 'id', label: 'Email ID', type: 'string' },
            { key: 'threadId', label: 'Thread ID', type: 'string' },
            { key: 'labelIds', label: 'Label IDs', type: 'string', list: true },
            { key: 'snippet', label: 'Snippet', type: 'string' },
            { key: 'success', label: 'Success', type: 'boolean' },
        ],
        perform,
        sample: {
            id: 'sent-email-123456789',
            threadId: 'thread-123456789',
            labelIds: ['SENT'],
            snippet: 'Thank you for your inquiry. We will get back to you soon.',
            success: true,
        },
    },
};
//# sourceMappingURL=send-email.js.map
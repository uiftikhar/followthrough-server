import { Bundle, ZObject } from 'zapier-platform-core';
export interface EmailTriageOutput {
    triageId: string;
    status: 'processing' | 'completed' | 'failed';
    classification?: {
        category: string;
        priority: string;
        sentiment: string;
        urgency: string;
    };
    summary?: string;
    suggestedActions?: string[];
    draftReply?: {
        subject: string;
        body: string;
        tone: string;
    };
    extractedTasks?: Array<{
        title: string;
        description: string;
        priority: string;
        dueDate?: string;
    }>;
    processingTime?: number;
    confidence?: number;
}
declare const _default: {
    key: string;
    noun: string;
    display: {
        label: string;
        description: string;
    };
    operation: {
        inputFields: ({
            key: string;
            label: string;
            type: string;
            required: boolean;
            helpText: string;
            choices?: undefined;
            default?: undefined;
        } | {
            key: string;
            label: string;
            type: string;
            required: boolean;
            choices: string[];
            default: string;
            helpText: string;
        })[];
        outputFields: ({
            key: string;
            label: string;
            type: string;
            list?: undefined;
        } | {
            key: string;
            label: string;
            type: string;
            list: boolean;
        })[];
        perform: (z: ZObject, bundle: Bundle) => Promise<EmailTriageOutput>;
        sample: {
            triageId: string;
            status: string;
            classification: {
                category: string;
                priority: string;
                sentiment: string;
                urgency: string;
            };
            summary: string;
            suggestedActions: string[];
            draftReply: {
                subject: string;
                body: string;
                tone: string;
            };
            extractedTasks: string[];
            processingTime: number;
            confidence: number;
        };
    };
};
export default _default;
//# sourceMappingURL=trigger-email-triage.d.ts.map
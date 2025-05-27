import { Bundle, ZObject } from 'zapier-platform-core';
export interface MeetingAnalysisOutput {
    analysisId: string;
    status: 'processing' | 'completed' | 'failed';
    insights?: {
        purpose: string;
        keyTopics: string[];
        actionItems: string[];
        decisions: string[];
        nextSteps: string[];
    };
    summary?: string;
    attendeeAnalysis?: {
        totalAttendees: number;
        keyStakeholders: string[];
        missingStakeholders: string[];
    };
    followUpTasks?: Array<{
        title: string;
        description: string;
        assignee?: string;
        dueDate?: string;
        priority: string;
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
            list?: undefined;
        } | {
            key: string;
            label: string;
            type: string;
            required: boolean;
            list: boolean;
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
        perform: (z: ZObject, bundle: Bundle) => Promise<MeetingAnalysisOutput>;
        sample: {
            analysisId: string;
            status: string;
            insights: {
                purpose: string;
                keyTopics: string[];
                actionItems: string[];
                decisions: string[];
                nextSteps: string[];
            };
            summary: string;
            attendeeAnalysis: {
                totalAttendees: number;
                keyStakeholders: string[];
                missingStakeholders: string[];
            };
            followUpTasks: string[];
            processingTime: number;
            confidence: number;
        };
    };
};
export default _default;
//# sourceMappingURL=trigger-meeting-analysis.d.ts.map
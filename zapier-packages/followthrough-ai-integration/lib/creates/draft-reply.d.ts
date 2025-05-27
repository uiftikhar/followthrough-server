import { Bundle, ZObject } from 'zapier-platform-core';
export interface DraftReplyOutput {
    draftId: string;
    subject: string;
    body: string;
    tone: string;
    confidence: number;
    suggestedActions: string[];
    estimatedReadTime: number;
    keyPoints: string[];
    success: boolean;
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
        } | {
            key: string;
            label: string;
            type: string;
            required: boolean;
            default: string;
            helpText: string;
            choices?: undefined;
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
        perform: (z: ZObject, bundle: Bundle) => Promise<DraftReplyOutput>;
        sample: {
            draftId: string;
            subject: string;
            body: string;
            tone: string;
            confidence: number;
            suggestedActions: string[];
            estimatedReadTime: number;
            keyPoints: string[];
            success: boolean;
        };
    };
};
export default _default;
//# sourceMappingURL=draft-reply.d.ts.map
import { Bundle, ZObject } from 'zapier-platform-core';
export interface EmailSearchTrigger {
    id: string;
    subject: string;
    from: string;
    to: string;
    body: string;
    timestamp: string;
    headers: Record<string, string>;
    threadId: string;
    snippet: string;
    labels: string[];
    matchedQuery: string;
}
declare const _default: {
    key: string;
    noun: string;
    display: {
        label: string;
        description: string;
    };
    operation: {
        type: string;
        performSubscribe: (z: ZObject, bundle: Bundle) => Promise<any>;
        performUnsubscribe: (z: ZObject, bundle: Bundle) => Promise<{
            success: boolean;
            error?: undefined;
        } | {
            success: boolean;
            error: string;
        }>;
        perform: (z: ZObject, bundle: Bundle) => Promise<EmailSearchTrigger[]>;
        performList: (z: ZObject, bundle: Bundle) => Promise<EmailSearchTrigger[]>;
        inputFields: ({
            key: string;
            label: string;
            helpText: string;
            type: string;
            required: boolean;
            placeholder: string;
            default?: undefined;
        } | {
            key: string;
            label: string;
            helpText: string;
            type: string;
            required: boolean;
            default: string;
            placeholder?: undefined;
        } | {
            key: string;
            label: string;
            helpText: string;
            type: string;
            required: boolean;
            placeholder?: undefined;
            default?: undefined;
        })[];
        sample: {
            id: string;
            subject: string;
            from: string;
            to: string;
            body: string;
            timestamp: string;
            headers: {
                'message-id': string;
                'reply-to': string;
            };
            threadId: string;
            snippet: string;
            labels: string[];
            matchedQuery: string;
        };
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
    };
};
export default _default;
//# sourceMappingURL=email-matching-search.d.ts.map
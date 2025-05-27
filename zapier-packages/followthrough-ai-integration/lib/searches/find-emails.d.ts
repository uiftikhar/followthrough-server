import { Bundle, ZObject } from 'zapier-platform-core';
export interface EmailSearchResult {
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
    hasAttachments: boolean;
    isUnread: boolean;
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
            default?: undefined;
        } | {
            key: string;
            label: string;
            type: string;
            required: boolean;
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
        perform: (z: ZObject, bundle: Bundle) => Promise<EmailSearchResult[]>;
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
            hasAttachments: boolean;
            isUnread: boolean;
        };
    };
};
export default _default;
//# sourceMappingURL=find-emails.d.ts.map
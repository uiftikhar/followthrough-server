import { Bundle, ZObject } from 'zapier-platform-core';
export interface EmailTrigger {
    id: string;
    subject: string;
    from: string;
    to: string;
    body: string;
    timestamp: string;
    headers: string;
    threadId: string;
    snippet: string;
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
            error: any;
        }>;
        perform: (z: ZObject, bundle: Bundle) => Promise<EmailTrigger[]>;
        performList: (z: ZObject, bundle: Bundle) => Promise<EmailTrigger[]>;
        inputFields: ({
            key: string;
            label: string;
            helpText: string;
            type: string;
            required: boolean;
            default: string;
        } | {
            key: string;
            label: string;
            helpText: string;
            type: string;
            required: boolean;
            default?: undefined;
        })[];
        sample: {
            id: string;
            subject: string;
            from: string;
            to: string;
            body: string;
            timestamp: string;
            headers: string;
            threadId: string;
            snippet: string;
        };
        outputFields: {
            key: string;
            label: string;
            type: string;
        }[];
    };
};
export default _default;
//# sourceMappingURL=new-email.d.ts.map
import { Bundle, ZObject } from 'zapier-platform-core';
export interface SendEmailOutput {
    id: string;
    threadId: string;
    labelIds: string[];
    snippet: string;
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
        perform: (z: ZObject, bundle: Bundle) => Promise<SendEmailOutput>;
        sample: {
            id: string;
            threadId: string;
            labelIds: string[];
            snippet: string;
            success: boolean;
        };
    };
};
export default _default;
//# sourceMappingURL=send-email.d.ts.map
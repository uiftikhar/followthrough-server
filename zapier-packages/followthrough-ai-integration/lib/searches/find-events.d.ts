import { Bundle, ZObject } from 'zapier-platform-core';
export interface EventSearchResult {
    id: string;
    summary: string;
    description: string;
    start: string;
    end: string;
    attendees: string[];
    location: string;
    creator: string;
    created: string;
    updated: string;
    htmlLink: string;
    status: string;
    organizer: string;
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
            choices?: undefined;
        } | {
            key: string;
            label: string;
            type: string;
            required: boolean;
            default: string;
            helpText: string;
            choices?: undefined;
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
        perform: (z: ZObject, bundle: Bundle) => Promise<EventSearchResult[]>;
        sample: {
            id: string;
            summary: string;
            description: string;
            start: string;
            end: string;
            attendees: string[];
            location: string;
            creator: string;
            created: string;
            updated: string;
            htmlLink: string;
            status: string;
            organizer: string;
        };
    };
};
export default _default;
//# sourceMappingURL=find-events.d.ts.map
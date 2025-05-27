import { Bundle, ZObject } from 'zapier-platform-core';
export interface CalendarEventTrigger {
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
        perform: (z: ZObject, bundle: Bundle) => Promise<CalendarEventTrigger[]>;
        performList: (z: ZObject, bundle: Bundle) => Promise<CalendarEventTrigger[]>;
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
//# sourceMappingURL=new-calendar-event.d.ts.map
import { Bundle, ZObject } from 'zapier-platform-core';
export interface CreateCalendarEventOutput {
    id: string;
    summary: string;
    description: string;
    start: string;
    end: string;
    attendees: string[];
    location: string;
    htmlLink: string;
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
            list?: undefined;
            default?: undefined;
        } | {
            key: string;
            label: string;
            type: string;
            required: boolean;
            list: boolean;
            helpText: string;
            default?: undefined;
        } | {
            key: string;
            label: string;
            type: string;
            required: boolean;
            default: string;
            helpText: string;
            list?: undefined;
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
        perform: (z: ZObject, bundle: Bundle) => Promise<CreateCalendarEventOutput>;
        sample: {
            id: string;
            summary: string;
            description: string;
            start: string;
            end: string;
            attendees: string[];
            location: string;
            htmlLink: string;
            success: boolean;
        };
    };
};
export default _default;
//# sourceMappingURL=create-calendar-event.d.ts.map
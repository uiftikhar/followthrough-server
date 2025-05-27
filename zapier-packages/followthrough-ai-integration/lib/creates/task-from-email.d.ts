import { Bundle, ZObject } from 'zapier-platform-core';
export interface TaskFromEmailOutput {
    taskId: string;
    title: string;
    description: string;
    priority: string;
    dueDate?: string;
    assignee?: string;
    category: string;
    estimatedTime?: number;
    dependencies?: string[];
    tags: string[];
    sourceEmail: {
        id: string;
        subject: string;
        from: string;
    };
    confidence: number;
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
        perform: (z: ZObject, bundle: Bundle) => Promise<TaskFromEmailOutput>;
        sample: {
            taskId: string;
            title: string;
            description: string;
            priority: string;
            dueDate: string;
            assignee: string;
            category: string;
            estimatedTime: number;
            dependencies: string[];
            tags: string[];
            sourceEmail: {
                id: string;
                subject: string;
                from: string;
            };
            confidence: number;
            success: boolean;
        };
    };
};
export default _default;
//# sourceMappingURL=task-from-email.d.ts.map
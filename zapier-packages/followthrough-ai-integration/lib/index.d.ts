import newEmailTrigger from './triggers/new-email';
import triggerEmailTriageAction from './actions/trigger-email-triage';
import draftReplyCreate from './creates/draft-reply';
import findEmailsSearch from './searches/find-emails';
import triggerMeetingAnalysisAction from './actions/trigger-meeting-analysis';
import sendEmailAction from './actions/send-email';
import newCalendarEventTrigger from './triggers/new-calendar-event';
import emailMatchingSearchTrigger from './triggers/email-matching-search';
import createCalendarEventAction from './actions/create-calendar-event';
import taskFromEmailCreate from './creates/task-from-email';
import findEventsSearch from './searches/find-events';
declare const _default: {
    version: string;
    platformVersion: any;
    authentication: {
        type: "oauth2";
        oauth2Config: {
            authorizeUrl: {
                url: string;
                params: {
                    client_id: string;
                    state: string;
                    redirect_uri: string;
                    response_type: string;
                    access_type: string;
                    prompt: string;
                    scope: string;
                };
            };
            getAccessToken: {
                url: string;
                method: string;
                headers: {
                    'Content-Type': string;
                    Accept: string;
                };
                body: {
                    grant_type: string;
                    client_id: string;
                    client_secret: string;
                    code: string;
                    redirect_uri: string;
                };
            };
            refreshAccessToken: {
                url: string;
                method: string;
                headers: {
                    'Content-Type': string;
                    Accept: string;
                };
                body: {
                    grant_type: string;
                    refresh_token: string;
                    client_id: string;
                    client_secret: string;
                };
            };
            scope: string;
            autoRefresh: boolean;
        };
        test: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<{
            id: any;
            email: any;
            name: any;
        }>;
        connectionLabel: string;
        fields: {
            key: string;
            label: string;
            required: boolean;
            helpText: string;
            type: "password";
        }[];
    };
    triggers: {
        [newEmailTrigger.key]: {
            key: string;
            noun: string;
            display: {
                label: string;
                description: string;
            };
            operation: {
                type: string;
                performSubscribe: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<any>;
                performUnsubscribe: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<{
                    success: boolean;
                    error?: undefined;
                } | {
                    success: boolean;
                    error: any;
                }>;
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./triggers/new-email").EmailTrigger[]>;
                performList: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./triggers/new-email").EmailTrigger[]>;
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
        [newCalendarEventTrigger.key]: {
            key: string;
            noun: string;
            display: {
                label: string;
                description: string;
            };
            operation: {
                type: string;
                performSubscribe: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<any>;
                performUnsubscribe: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<{
                    success: boolean;
                    error?: undefined;
                } | {
                    success: boolean;
                    error: string;
                }>;
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./triggers/new-calendar-event").CalendarEventTrigger[]>;
                performList: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./triggers/new-calendar-event").CalendarEventTrigger[]>;
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
        [emailMatchingSearchTrigger.key]: {
            key: string;
            noun: string;
            display: {
                label: string;
                description: string;
            };
            operation: {
                type: string;
                performSubscribe: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<any>;
                performUnsubscribe: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<{
                    success: boolean;
                    error?: undefined;
                } | {
                    success: boolean;
                    error: string;
                }>;
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./triggers/email-matching-search").EmailSearchTrigger[]>;
                performList: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./triggers/email-matching-search").EmailSearchTrigger[]>;
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
    };
    creates: {
        [triggerEmailTriageAction.key]: {
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
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./actions/trigger-email-triage").EmailTriageOutput>;
                sample: {
                    triageId: string;
                    status: string;
                    classification: {
                        category: string;
                        priority: string;
                        sentiment: string;
                        urgency: string;
                    };
                    summary: string;
                    suggestedActions: string[];
                    draftReply: {
                        subject: string;
                        body: string;
                        tone: string;
                    };
                    extractedTasks: string[];
                    processingTime: number;
                    confidence: number;
                };
            };
        };
        [triggerMeetingAnalysisAction.key]: {
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
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./actions/trigger-meeting-analysis").MeetingAnalysisOutput>;
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
        [sendEmailAction.key]: {
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
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./actions/send-email").SendEmailOutput>;
                sample: {
                    id: string;
                    threadId: string;
                    labelIds: string[];
                    snippet: string;
                    success: boolean;
                };
            };
        };
        [createCalendarEventAction.key]: {
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
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./actions/create-calendar-event").CreateCalendarEventOutput>;
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
        [draftReplyCreate.key]: {
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
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./creates/draft-reply").DraftReplyOutput>;
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
        [newEmailTrigger.key]: {
            key: string;
            noun: string;
            display: {
                label: string;
                description: string;
            };
            operation: {
                type: string;
                performSubscribe: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<any>;
                performUnsubscribe: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<{
                    success: boolean;
                    error?: undefined;
                } | {
                    success: boolean;
                    error: any;
                }>;
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./triggers/new-email").EmailTrigger[]>;
                performList: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./triggers/new-email").EmailTrigger[]>;
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
        [taskFromEmailCreate.key]: {
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
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./creates/task-from-email").TaskFromEmailOutput>;
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
    };
    searches: {
        [findEmailsSearch.key]: {
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
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./searches/find-emails").EmailSearchResult[]>;
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
        [findEventsSearch.key]: {
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
                perform: (z: import("zapier-platform-core").ZObject, bundle: import("zapier-platform-core").Bundle) => Promise<import("./searches/find-events").EventSearchResult[]>;
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
    };
    resources: {};
    hydrators: {};
    beforeRequest: never[];
    afterResponse: never[];
};
export default _default;
//# sourceMappingURL=index.d.ts.map
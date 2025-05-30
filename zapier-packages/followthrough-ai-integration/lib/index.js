"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const package_json_1 = require("../package.json");
const authentication_1 = require("./authentication");
const new_email_1 = __importDefault(require("./triggers/new-email"));
const trigger_email_triage_1 = __importDefault(require("./actions/trigger-email-triage"));
const draft_reply_1 = __importDefault(require("./creates/draft-reply"));
const find_emails_1 = __importDefault(require("./searches/find-emails"));
const trigger_meeting_analysis_1 = __importDefault(require("./actions/trigger-meeting-analysis"));
const send_email_1 = __importDefault(require("./actions/send-email"));
const new_calendar_event_1 = __importDefault(require("./triggers/new-calendar-event"));
const email_matching_search_1 = __importDefault(require("./triggers/email-matching-search"));
const create_calendar_event_1 = __importDefault(require("./actions/create-calendar-event"));
const task_from_email_1 = __importDefault(require("./creates/task-from-email"));
const find_events_1 = __importDefault(require("./searches/find-events"));
exports.default = {
    version: package_json_1.version,
    platformVersion: require('zapier-platform-core').version,
    authentication: authentication_1.authentication,
    // Triggers - when something happens in external service
    triggers: {
        [new_email_1.default.key]: new_email_1.default,
        [new_calendar_event_1.default.key]: new_calendar_event_1.default,
        [email_matching_search_1.default.key]: email_matching_search_1.default,
    },
    // Creates - create something in external service (includes actions)
    creates: {
        [trigger_email_triage_1.default.key]: trigger_email_triage_1.default,
        [trigger_meeting_analysis_1.default.key]: trigger_meeting_analysis_1.default,
        [send_email_1.default.key]: send_email_1.default,
        [create_calendar_event_1.default.key]: create_calendar_event_1.default,
        [draft_reply_1.default.key]: draft_reply_1.default,
        [new_email_1.default.key]: new_email_1.default,
        [task_from_email_1.default.key]: task_from_email_1.default,
    },
    // Searches - find something in external service
    searches: {
        [find_emails_1.default.key]: find_emails_1.default,
        [find_events_1.default.key]: find_events_1.default,
    },
    // Resources - define common data structures
    resources: {},
    // Hydrators - for lazy loading of data
    hydrators: {},
    // Middleware - for request/response processing
    beforeRequest: [],
    afterResponse: [],
};
//# sourceMappingURL=index.js.map
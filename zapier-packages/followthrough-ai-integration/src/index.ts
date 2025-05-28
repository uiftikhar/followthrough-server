import { version } from '../package.json';
import { authentication } from './authentication';
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

export default {
  version,
  platformVersion: require('zapier-platform-core').version,

  authentication,

  // Triggers - when something happens in external service
  triggers: {
    [newEmailTrigger.key]: newEmailTrigger,
    [newCalendarEventTrigger.key]: newCalendarEventTrigger,
    [emailMatchingSearchTrigger.key]: emailMatchingSearchTrigger,
  },

  // Creates - create something in external service (includes actions)
  creates: {
    [triggerEmailTriageAction.key]: triggerEmailTriageAction,
    [triggerMeetingAnalysisAction.key]: triggerMeetingAnalysisAction,
    [sendEmailAction.key]: sendEmailAction,
    [createCalendarEventAction.key]: createCalendarEventAction,
    [draftReplyCreate.key]: draftReplyCreate,
    [taskFromEmailCreate.key]: taskFromEmailCreate,
  },

  // Searches - find something in external service
  searches: {
    [findEmailsSearch.key]: findEmailsSearch,
    [findEventsSearch.key]: findEventsSearch,
  },

  // Resources - define common data structures
  resources: {},

  // Hydrators - for lazy loading of data
  hydrators: {},

  // Middleware - for request/response processing
  beforeRequest: [],
  afterResponse: [],
}; 
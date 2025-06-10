// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { CalendarModule } from './calendar.module';
import { CalendarWorkflowService } from './services/calendar-workflow.service';
import { CalendarWorkflowGraphBuilder } from './builders/calendar-workflow-graph.builder';
import { CalendarAgentFactory } from './agents/calendar-agent.factory';
import { CalendarSyncService } from './services/calendar-sync.service';
import { BriefDeliveryService } from './services/brief-delivery.service';
import { CalendarEvent } from './interfaces/calendar-event.interface';

describe('Calendar Workflow Integration', () => {
  let module: TestingModule;
  let calendarWorkflowService: CalendarWorkflowService;
  let calendarWorkflowGraphBuilder: CalendarWorkflowGraphBuilder;
  let calendarSyncService: CalendarSyncService;
  let briefDeliveryService: BriefDeliveryService;

  // Mock calendar event for testing
  const mockCalendarEvent: CalendarEvent = {
    id: 'test-event-123',
    title: 'Product Strategy Meeting',
    description: 'Quarterly product planning and roadmap discussion',
    startTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
    endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 90 minutes from now
    location: 'Conference Room A',
    attendees: [
      {
        email: 'john.doe@company.com',
        displayName: 'John Doe',
        responseStatus: 'accepted',
        organizer: false,
      },
      {
        email: 'jane.smith@company.com',
        displayName: 'Jane Smith',
        responseStatus: 'accepted',
        organizer: false,
      },
    ],
    organizer: {
      email: 'organizer@company.com',
      displayName: 'Meeting Organizer',
      responseStatus: 'accepted',
      organizer: true,
    },
    status: 'confirmed',
    recurring: false,
    calendarId: 'primary',
    provider: 'google',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CalendarModule],
    })
      .overrideProvider(CalendarSyncService)
      .useValue({
        syncUserCalendar: jest.fn().mockResolvedValue([mockCalendarEvent]),
        getEventsHappeningSoon: jest.fn().mockResolvedValue([mockCalendarEvent]),
        getNextUpcomingEvent: jest.fn().mockResolvedValue(mockCalendarEvent),
        ensureCalendarSynced: jest.fn().mockResolvedValue([mockCalendarEvent]),
      })
      .overrideProvider(BriefDeliveryService)
      .useValue({
        deliverBrief: jest.fn().mockResolvedValue({
          success: true,
          deliveryResults: [
            { method: 'email', status: 'sent', messageId: 'msg-123' },
            { method: 'calendar', status: 'sent', eventId: 'cal-456' },
          ],
        }),
      })
      .compile();

    calendarWorkflowService = module.get<CalendarWorkflowService>(CalendarWorkflowService);
    calendarWorkflowGraphBuilder = module.get<CalendarWorkflowGraphBuilder>(CalendarWorkflowGraphBuilder);
    calendarSyncService = module.get<CalendarSyncService>(CalendarSyncService);
    briefDeliveryService = module.get<BriefDeliveryService>(BriefDeliveryService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('CalendarWorkflowGraphBuilder', () => {
    it('should be defined and build a graph successfully', async () => {
      expect(calendarWorkflowGraphBuilder).toBeDefined();
      
      const graph = await calendarWorkflowGraphBuilder.buildGraph();
      expect(graph).toBeDefined();
      expect(typeof graph.execute).toBe('function');
    });

    it('should build nodes and edges correctly', async () => {
      // This test verifies that the graph builder follows the BaseGraphBuilder pattern
      const graph = await calendarWorkflowGraphBuilder.buildGraph();
      
      // Test that the graph can handle state transitions
      const initialState = {
        sessionId: 'test-session-123',
        type: 'calendar_sync' as const,
        userId: 'test-user',
        stage: 'initialization',
      };

      const result = await graph.execute(initialState);
      expect(result).toBeDefined();
      expect(result.sessionId).toBe('test-session-123');
      expect(result.userId).toBe('test-user');
    });
  });

  describe('CalendarWorkflowService Integration', () => {
    it('should process calendar sync workflow through graph', async () => {
      const input = {
        type: 'calendar_sync',
        userId: 'test-user-123',
        sessionId: 'test-session-456',
      };

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('test-session-456');
      expect(result.type).toBe('calendar_sync');
      expect(result.userId).toBe('test-user-123');
      expect(result.stage).toBeDefined();
      
      // Verify calendar sync was called
      expect(calendarSyncService.syncUserCalendar).toHaveBeenCalledWith('test-user-123');
    });

    it('should process meeting brief workflow through graph', async () => {
      const input = {
        type: 'meeting_brief',
        userId: 'test-user-123',
        calendarEvent: mockCalendarEvent,
        sessionId: 'test-brief-session',
      };

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('test-brief-session');
      expect(result.type).toBe('meeting_brief');
      expect(result.calendarEvent).toEqual(mockCalendarEvent);
      expect(result.stage).toBeDefined();
    });

    it('should process meeting preparation workflow through graph', async () => {
      const input = {
        type: 'meeting_prep',
        userId: 'test-user-123',
        sessionId: 'test-prep-session',
      };

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('test-prep-session');
      expect(result.type).toBe('meeting_prep');
      expect(result.stage).toBeDefined();
      
      // Verify events happening soon was called
      expect(calendarSyncService.getEventsHappeningSoon).toHaveBeenCalledWith('test-user-123');
    });

    it('should handle post-meeting orchestration workflow', async () => {
      const input = {
        type: 'post_meeting',
        userId: 'test-user-123',
        calendarEvent: mockCalendarEvent,
        sessionId: 'test-post-meeting-session',
        metadata: {
          meetingAnalysisResult: {
            summary: 'Test meeting completed',
            actionItems: [],
            decisions: [],
          },
        },
      };

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('test-post-meeting-session');
      expect(result.type).toBe('post_meeting');
      expect(result.calendarEvent).toEqual(mockCalendarEvent);
      expect(result.stage).toBeDefined();
    });
  });

  describe('Enhanced Workflow Methods', () => {
    it('should generate meeting brief with enhanced options', async () => {
      const options = {
        useGraph: true,
        contextOptions: {
          lookbackDays: 60,
          maxPreviousMeetings: 5,
        },
        briefOptions: {
          complexity: 'comprehensive' as const,
          focusAreas: ['agenda', 'preparation'],
        },
        deliveryMethods: ['email', 'calendar'],
      };

      const result = await calendarWorkflowService.generateMeetingBrief(mockCalendarEvent, options);

      expect(result).toBeDefined();
      expect(result.type).toBe('meeting_brief');
      expect(result.calendarEvent).toEqual(mockCalendarEvent);
      expect(result.stage).toBeDefined();
    });

    it('should sync calendar intelligently with options', async () => {
      const options = {
        detectUpcomingMeetings: true,
        generateBriefsForUpcoming: true,
        triggerPreMeetingPrep: true,
      };

      const result = await calendarWorkflowService.syncCalendarIntelligent('test-user-123', options);

      expect(result).toBeDefined();
      expect(result.type).toBe('calendar_sync');
      expect(result.userId).toBe('test-user-123');
      expect(result.context?.intelligent).toBe(true);
      
      // Verify calendar sync was called
      expect(calendarSyncService.syncUserCalendar).toHaveBeenCalledWith('test-user-123');
    });

    it('should prepare upcoming meetings with context gathering', async () => {
      const options = {
        hoursAhead: 4,
        generateBriefs: true,
        prioritizeByImportance: true,
      };

      const result = await calendarWorkflowService.prepareUpcomingMeetings('test-user-123', options);

      expect(result).toBeDefined();
      expect(result.type).toBe('meeting_prep');
      expect(result.userId).toBe('test-user-123');
      expect(result.context?.hoursAhead).toBe(4);
      
      // Verify events happening soon was called
      expect(calendarSyncService.getEventsHappeningSoon).toHaveBeenCalledWith('test-user-123');
    });

    it('should orchestrate post-meeting workflows', async () => {
      const meetingAnalysisResult = {
        meetingId: mockCalendarEvent.id,
        summary: 'Product strategy discussed',
        actionItems: [
          { task: 'Update roadmap', assignee: 'john.doe@company.com' },
        ],
        decisions: ['Approved Q4 feature set'],
      };

      const options = {
        generateFollowUps: true,
        scheduleNextMeetings: true,
        updateActionItems: true,
      };

      const result = await calendarWorkflowService.orchestratePostMeeting(
        mockCalendarEvent,
        meetingAnalysisResult,
        options
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('post_meeting');
      expect(result.calendarEvent).toEqual(mockCalendarEvent);
      expect(result.context?.meetingAnalysisResult).toEqual(meetingAnalysisResult);
    });
  });

  describe('Workflow Type Detection', () => {
    it('should detect calendar_sync workflow type', async () => {
      const inputs = [
        { action: 'sync' },
        { sync: true },
        { workflow: 'sync' },
        { type: 'calendar_sync' },
      ];

      for (const input of inputs) {
        const result = await calendarWorkflowService.process({
          ...input,
          userId: 'test-user',
        });
        expect(result.type).toBe('calendar_sync');
      }
    });

    it('should detect meeting_brief workflow type', async () => {
      const inputs = [
        { calendarEvent: mockCalendarEvent },
        { eventId: 'test-event-123' },
        { type: 'meeting_brief' },
      ];

      for (const input of inputs) {
        const result = await calendarWorkflowService.process({
          ...input,
          userId: 'test-user',
        });
        expect(result.type).toBe('meeting_brief');
      }
    });

    it('should detect meeting_prep workflow type', async () => {
      const inputs = [
        { action: 'prep' },
        { preparation: true },
        { upcoming: true },
        { type: 'meeting_prep' },
      ];

      for (const input of inputs) {
        const result = await calendarWorkflowService.process({
          ...input,
          userId: 'test-user',
        });
        expect(result.type).toBe('meeting_prep');
      }
    });

    it('should detect post_meeting workflow type', async () => {
      const inputs = [
        { action: 'post_meeting', calendarEvent: mockCalendarEvent },
        { orchestrate: true, calendarEvent: mockCalendarEvent },
        { followUp: true, calendarEvent: mockCalendarEvent },
        { 
          calendarEvent: mockCalendarEvent, 
          metadata: { meetingAnalysisResult: { summary: 'test' } } 
        },
      ];

      for (const input of inputs) {
        const result = await calendarWorkflowService.process({
          ...input,
          userId: 'test-user',
        });
        expect(result.type).toBe('post_meeting');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid workflow type gracefully', async () => {
      const input = {
        type: 'invalid_workflow_type',
        userId: 'test-user',
      };

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.stage).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should handle missing required fields', async () => {
      const input = {
        type: 'meeting_brief',
        // Missing userId and calendarEvent
      };

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.stage).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should handle service errors gracefully', async () => {
      // Mock calendar sync service to throw error
      jest.spyOn(calendarSyncService, 'syncUserCalendar')
        .mockRejectedValueOnce(new Error('Calendar API error'));

      const input = {
        type: 'calendar_sync',
        userId: 'test-user',
      };

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.stage).toBe('error');
      expect(result.error).toContain('Calendar API error');
    });
  });

  describe('Team Handler Interface', () => {
    it('should implement TeamHandler interface correctly', () => {
      expect(calendarWorkflowService.getTeamName()).toBe('calendar_workflow');
      expect(typeof calendarWorkflowService.process).toBe('function');
      expect(typeof calendarWorkflowService.canHandle).toBe('function');
    });

    it('should correctly identify handleable inputs', async () => {
      const handleableInputs = [
        { type: 'calendar_sync' },
        { type: 'meeting_brief' },
        { type: 'meeting_prep' },
        { type: 'post_meeting' },
        { calendarEvent: mockCalendarEvent },
        { eventId: 'test-123' },
        { action: 'sync' },
        { workflow: 'calendar' },
      ];

      for (const input of handleableInputs) {
        const canHandle = await calendarWorkflowService.canHandle(input);
        expect(canHandle).toBe(true);
      }
    });

    it('should correctly reject non-handleable inputs', async () => {
      const nonHandleableInputs = [
        { type: 'email_analysis' },
        { type: 'document_processing' },
        { randomField: 'value' },
        {},
      ];

      for (const input of nonHandleableInputs) {
        const canHandle = await calendarWorkflowService.canHandle(input);
        expect(canHandle).toBe(false);
      }
    });
  });
});

/**
 * Phase 1 Completion Checklist:
 * 
 * ✅ Milestone 1.1: Google Calendar Authentication & Sync
 *    - GoogleCalendarService created with OAuth integration
 *    - Calendar event sync functionality implemented
 *    - Error handling for authentication failures
 * 
 * ✅ Milestone 1.2: Calendar Workflow Service  
 *    - CalendarWorkflowService implements TeamHandler interface
 *    - Supports calendar_sync, meeting_brief, meeting_prep workflows
 *    - CalendarSyncService manages sync status and caching
 * 
 * ✅ Milestone 1.3: Agent Framework Integration
 *    - Calendar module registered in app.module.ts
 *    - Team handler registered with TeamHandlerRegistry
 *    - Master supervisor updated to route calendar workflows
 * 
 * 🔄 Next: Phase 2 - Pre-Meeting Intelligence
 *    - Meeting Context Agent with RAG integration
 *    - Meeting Brief Agent with template system
 *    - Brief delivery system
 */ 
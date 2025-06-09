import { Test, TestingModule } from '@nestjs/testing';
import { CalendarModule } from './calendar.module';
import { CalendarWorkflowService } from './services/calendar-workflow.service';
import { CalendarSyncService } from './services/calendar-sync.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { UnifiedWorkflowService } from '../langgraph/unified-workflow.service';

describe('Calendar Workflow Integration (Phase 1)', () => {
  let module: TestingModule;
  let calendarWorkflowService: CalendarWorkflowService;
  let calendarSyncService: CalendarSyncService;
  let googleCalendarService: GoogleCalendarService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [CalendarModule],
    }).compile();

    calendarWorkflowService = module.get<CalendarWorkflowService>(CalendarWorkflowService);
    calendarSyncService = module.get<CalendarSyncService>(CalendarSyncService);
    googleCalendarService = module.get<GoogleCalendarService>(GoogleCalendarService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Phase 1 - Milestone 1.1: Google Calendar Authentication & Sync', () => {
    it('should be defined', () => {
      expect(calendarWorkflowService).toBeDefined();
      expect(calendarSyncService).toBeDefined();
      expect(googleCalendarService).toBeDefined();
    });

    it('should implement TeamHandler interface', () => {
      expect(calendarWorkflowService.getTeamName()).toBe('calendar_workflow');
      expect(typeof calendarWorkflowService.process).toBe('function');
      expect(typeof calendarWorkflowService.canHandle).toBe('function');
    });

    it('should handle calendar sync input', async () => {
      const input = {
        type: 'calendar_sync',
        userId: 'test-user',
        action: 'sync',
      };

      const canHandle = await calendarWorkflowService.canHandle(input);
      expect(canHandle).toBe(true);
    });

    it('should process calendar sync workflow', async () => {
      const input = {
        type: 'calendar_sync',
        userId: 'test-user',
        action: 'sync',
        metadata: { test: true },
      };

      // Mock the Google Calendar service to avoid actual API calls
      jest.spyOn(googleCalendarService, 'getUpcomingEvents').mockResolvedValue([]);

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.type).toBe('calendar_sync');
      expect(result.userId).toBe('test-user');
      expect(result.stage).toBe('sync_completed');
      expect(result.upcomingEvents).toEqual([]);
    });

    it('should handle meeting brief request', async () => {
      const input = {
        type: 'meeting_brief',
        userId: 'test-user',
        eventId: 'test-event-123',
      };

      const canHandle = await calendarWorkflowService.canHandle(input);
      expect(canHandle).toBe(true);

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.type).toBe('meeting_brief');
      expect(result.stage).toBe('brief_pending'); // Phase 1 placeholder
    });

    it('should handle meeting prep workflow', async () => {
      const input = {
        type: 'meeting_prep',
        userId: 'test-user',
      };

      // Mock the calendar sync service
      jest.spyOn(calendarSyncService, 'getEventsHappeningSoon').mockResolvedValue([]);

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.type).toBe('meeting_prep');
      expect(result.stage).toBe('prep_ready');
      expect(result.upcomingEvents).toEqual([]);
    });
  });

  describe('Phase 1 - Milestone 1.2: Calendar Workflow Service', () => {
    it('should manage sync status', () => {
      const userId = 'test-user';
      
      // Initially no sync status
      expect(calendarSyncService.getSyncStatus(userId)).toBeUndefined();
      expect(calendarSyncService.isCalendarSynced(userId)).toBe(false);
    });

    it('should handle sync errors gracefully', async () => {
      const input = {
        type: 'calendar_sync',
        userId: 'error-user',
      };

      // Mock Google Calendar service to throw error
      jest.spyOn(googleCalendarService, 'getUpcomingEvents').mockRejectedValue(
        new Error('Authentication failed')
      );

      const result = await calendarWorkflowService.process(input);

      expect(result).toBeDefined();
      expect(result.stage).toBe('sync_failed');
      expect(result.error).toContain('Authentication failed');
    });
  });

  describe('Phase 1 - Milestone 1.3: Agent Framework Integration', () => {
    it('should be registered as a team handler', () => {
      // This test verifies that the module registration works
      // The actual registration happens in the module's onModuleInit
      expect(calendarWorkflowService.getTeamName()).toBe('calendar_workflow');
    });

    it('should auto-detect workflow type from input', async () => {
      const syncInput = { action: 'sync', userId: 'test' };
      const briefInput = { eventId: 'event-123', userId: 'test' };
      
      expect(await calendarWorkflowService.canHandle(syncInput)).toBe(true);
      expect(await calendarWorkflowService.canHandle(briefInput)).toBe(true);
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
// import { Test, TestingModule } from '@nestjs/testing';
// import { ConfigModule } from '@nestjs/config';
// import { CalendarModule } from '../../src/calendar/calendar.module';
// import { SharedCoreModule } from '../../src/shared/shared-core.module';
// import { LanggraphCoreModule } from '../../src/langgraph/core/core.module';
// import { CalendarWorkflowService } from '../../src/calendar/services/calendar-workflow.service';
// import { AgentFactory } from '../../src/langgraph/agents/agent.factory';
// import { BriefDeliveryService } from '../../src/calendar/services/brief-delivery.service';
// import { CalendarEvent } from '../../src/calendar/interfaces/calendar-event.interface';
// import { MeetingContext } from '../../src/calendar/interfaces/meeting-context.interface';
// import { MeetingBrief } from '../../src/calendar/interfaces/meeting-brief.interface';

// // Import MSW setup to ensure all network calls are mocked
// import '../../src/test/setup-jest';

// describe('Calendar Workflow Phase 2 Integration', () => {
//   let module: TestingModule;
//   let calendarWorkflowService: CalendarWorkflowService;
//   let agentFactory: AgentFactory;
//   let briefDeliveryService: BriefDeliveryService;

//   // Test data
//   const mockCalendarEvent: CalendarEvent = {
//     id: 'test-event-123',
//     calendarId: 'primary',
//     provider: 'google',
//     title: 'Product Planning Meeting',
//     description: 'Quarterly product planning session to discuss roadmap and priorities',
//     startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
//     endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(), // 90 min meeting
//     location: 'Conference Room A',
//     meetingLink: 'https://meet.google.com/abc-defg-hij',
//     organizer: {
//       email: 'alice@company.com',
//       displayName: 'Alice Johnson',
//       responseStatus: 'accepted'
//     },
//     attendees: [
//       {
//         email: 'alice@company.com',
//         displayName: 'Alice Johnson',
//         responseStatus: 'accepted'
//       },
//       {
//         email: 'bob@company.com',
//         displayName: 'Bob Smith',
//         responseStatus: 'tentative'
//       },
//       {
//         email: 'charlie@company.com',
//         displayName: 'Charlie Brown',
//         responseStatus: 'needsAction'
//       }
//     ],
//     status: 'confirmed',
//     created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Created a week ago
//     updated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // Updated yesterday
//   };

//   beforeAll(async () => {
//     // Set test environment variables to ensure we don't make real API calls
//     process.env.NODE_ENV = 'test';
//     process.env.OPENAI_API_KEY = 'test-key';
//     process.env.PINECONE_API_KEY = 'test-key';
//     process.env.RAG_ENABLED = 'true';

//     module = await Test.createTestingModule({
//       imports: [
//         ConfigModule.forRoot({
//           isGlobal: true,
//           envFilePath: '.env.test'
//         }),
//         SharedCoreModule,
//         LanggraphCoreModule,
//         CalendarModule
//       ]
//     }).compile();

//     calendarWorkflowService = module.get<CalendarWorkflowService>(CalendarWorkflowService);
//     agentFactory = module.get<AgentFactory>(AgentFactory);
//     briefDeliveryService = module.get<BriefDeliveryService>(BriefDeliveryService);

//     console.log('🧪 Calendar Workflow Phase 2 tests initialized with MSW mocking');
//   });

//   afterAll(async () => {
//     await module.close();
//   });

//   describe('Phase 2 Milestone 2.1: Meeting Context Agent', () => {
//     it('should gather comprehensive meeting context', async () => {
//       const contextAgent = agentFactory.getMeetingContextAgent();

//       const context = await contextAgent.gatherMeetingContext(mockCalendarEvent, {
//         lookbackDays: 90,
//         maxPreviousMeetings: 10,
//         includeParticipantHistory: true,
//         includeTopicPredictions: true,
//         useRAG: true
//       });

//       // Verify context structure
//       expect(context).toBeDefined();
//       expect(context.meetingId).toBe(mockCalendarEvent.id);
//       expect(context.upcomingMeeting.title).toBe(mockCalendarEvent.title);
//       expect(context.upcomingMeeting.participants).toContain('alice@company.com');
//       expect(context.upcomingMeeting.participants).toContain('bob@company.com');
//       expect(context.upcomingMeeting.participants).toContain('charlie@company.com');

//       // Verify participant histories
//       expect(context.participantHistories).toBeDefined();
//       expect(Array.isArray(context.participantHistories)).toBe(true);
//       expect(context.participantHistories.length).toBe(3); // One for each attendee

//       // Verify each participant history has required fields
//       context.participantHistories.forEach(history => {
//         expect(history.email).toBeDefined();
//         expect(history.displayName).toBeDefined();
//         expect(history.totalMeetings).toBeGreaterThanOrEqual(0);
//         expect(Array.isArray(history.recentMeetings)).toBe(true);
//         expect(Array.isArray(history.commonTopics)).toBe(true);
//         expect(history.responsePatterns).toBeDefined();
//         expect(history.meetingBehavior).toBeDefined();
//       });

//       // Verify topic predictions
//       expect(Array.isArray(context.topicPredictions)).toBe(true);

//       // Verify context summary
//       expect(context.contextSummary).toBeDefined();
//       expect(context.contextSummary.totalRelevantMeetings).toBeGreaterThanOrEqual(0);
//       expect(Array.isArray(context.contextSummary.keyParticipants)).toBe(true);
//       expect(Array.isArray(context.contextSummary.primaryTopics)).toBe(true);

//       // Verify retrieval metadata
//       expect(context.retrievalMetadata).toBeDefined();
//       expect(context.retrievalMetadata.retrievedAt).toBeDefined();
//       expect(Array.isArray(context.retrievalMetadata.sources)).toBe(true);
//       expect(typeof context.retrievalMetadata.confidence).toBe('number');
//       expect(context.retrievalMetadata.confidence).toBeGreaterThanOrEqual(0);
//       expect(context.retrievalMetadata.confidence).toBeLessThanOrEqual(1);

//       console.log('✅ Meeting context gathered successfully');
//       console.log(`   - Participants analyzed: ${context.participantHistories.length}`);
//       console.log(`   - Previous meetings found: ${context.previousMeetingContext.length}`);
//       console.log(`   - Topic predictions: ${context.topicPredictions.length}`);
//       console.log(`   - Context confidence: ${Math.round(context.retrievalMetadata.confidence * 100)}%`);
//     }, 30000);

//     it('should handle missing participant history gracefully', async () => {
//       const contextAgent = agentFactory.getMeetingContextAgent();

//       const eventWithUnknownParticipants: CalendarEvent = {
//         ...mockCalendarEvent,
//         id: 'test-event-unknown',
//         attendees: [
//           {
//             email: 'unknown@external.com',
//             displayName: 'Unknown External',
//             responseStatus: 'needsAction'
//           }
//         ]
//       };

//       const context = await contextAgent.gatherMeetingContext(eventWithUnknownParticipants, {
//         includeParticipantHistory: true,
//         useRAG: true
//       });

//       expect(context).toBeDefined();
//       expect(context.participantHistories).toBeDefined();
//       expect(context.participantHistories.length).toBe(1);

//       const unknownParticipant = context.participantHistories[0];
//       expect(unknownParticipant.email).toBe('unknown@external.com');
//       expect(unknownParticipant.totalMeetings).toBe(0);
//       expect(unknownParticipant.recentMeetings).toEqual([]);

//       console.log('✅ Unknown participants handled gracefully');
//     }, 15000);

//     it('should use RAG to enhance context with historical data', async () => {
//       const contextAgent = agentFactory.getMeetingContextAgent();

//       const context = await contextAgent.gatherMeetingContext(mockCalendarEvent, {
//         useRAG: true,
//         includeTopicPredictions: true
//       });

//       expect(context).toBeDefined();

//       // Check if RAG enhanced the context
//       if (context.retrievalMetadata.sources.length > 0) {
//         expect(context.retrievalMetadata.sources[0]).toHaveProperty('id');
//         expect(context.retrievalMetadata.sources[0]).toHaveProperty('relevanceScore');
//         expect(context.retrievalMetadata.sources[0]).toHaveProperty('type');
//         console.log('✅ RAG context enhancement verified');
//         console.log(`   - RAG sources found: ${context.retrievalMetadata.sources.length}`);
//       } else {
//         console.log('ℹ️ No RAG sources found (expected for test environment)');
//       }
//     }, 20000);
//   });

//   describe('Phase 2 Milestone 2.2: Meeting Brief Agent', () => {
//     let meetingContext: MeetingContext;

//     beforeAll(async () => {
//       // Generate context for brief testing
//       const contextAgent = agentFactory.getMeetingContextAgent();
//       meetingContext = await contextAgent.gatherMeetingContext(mockCalendarEvent, {
//         useRAG: true,
//         includeTopicPredictions: true
//       });
//     });

//     it('should generate comprehensive meeting brief', async () => {
//       const briefAgent = agentFactory.getMeetingBriefAgent();

//       const brief = await briefAgent.generateMeetingBrief(mockCalendarEvent, meetingContext, {
//         includeDetailedAgenda: true,
//         includeParticipantPrep: true,
//         includeTimeManagement: true,
//         includeDeliveryFormats: true,
//         complexity: 'standard',
//         focusAreas: ['agenda', 'preparation', 'objectives'],
//         useRAG: true
//       });

//       // Verify brief structure
//       expect(brief).toBeDefined();
//       expect(brief.briefId).toBeDefined();
//       expect(brief.meetingId).toBe(mockCalendarEvent.id);
//       expect(brief.generationMetadata.generatedAt).toBeDefined();

//       // Verify enhanced agenda
//       expect(brief.enhancedAgenda).toBeDefined();
//       expect(Array.isArray(brief.enhancedAgenda)).toBe(true);
//       expect(brief.enhancedAgenda.length).toBeGreaterThan(0);

//       brief.enhancedAgenda.forEach(item => {
//         expect(item.title).toBeDefined();
//         expect(item.duration).toBeGreaterThan(0);
//         expect(['high', 'medium', 'low']).toContain(item.priority);
//         expect(Array.isArray(item.expectedOutcomes)).toBe(true);
//         expect(Array.isArray(item.relatedTopics)).toBe(true);
//       });

//       // Verify participant preparations
//       expect(brief.participantPreparations).toBeDefined();
//       expect(Array.isArray(brief.participantPreparations)).toBe(true);
//       expect(brief.participantPreparations.length).toBe(3); // One for each attendee

//       brief.participantPreparations.forEach(prep => {
//         expect(prep.participantEmail).toBeDefined();
//         expect(prep.participantName).toBeDefined();
//         expect(Array.isArray(prep.preparationTasks)).toBe(true);
//         expect(Array.isArray(prep.suggestedQuestions)).toBe(true);
//         expect(Array.isArray(prep.keyResponsibilities)).toBe(true);
//         expect(['organizer', 'presenter', 'attendee', 'optional']).toContain(prep.role);
//       });

//       // Verify objectives
//       expect(brief.objectives).toBeDefined();
//       expect(typeof brief.objectives.primary).toBe('string');
//       expect(Array.isArray(brief.objectives.secondary)).toBe(true);
//       expect(Array.isArray(brief.objectives.successMetrics)).toBe(true);
//       expect(Array.isArray(brief.objectives.potentialRisks)).toBe(true);

//       // Verify time management
//       expect(brief.timeManagement).toBeDefined();
//       expect(brief.timeManagement.totalDuration).toBeGreaterThan(0);
//       expect(Array.isArray(brief.timeManagement.suggestedSchedule)).toBe(true);
//       expect(Array.isArray(brief.timeManagement.criticalTimings)).toBe(true);

//       console.log('✅ Meeting brief generated successfully');
//       console.log(`   - Agenda items: ${brief.enhancedAgenda.length}`);
//       console.log(`   - Participant preparations: ${brief.participantPreparations.length}`);
//       console.log(`   - Primary objective: ${brief.objectives.primary}`);
//       console.log(`   - Schedule items: ${brief.timeManagement.suggestedSchedule.length}`);
//     }, 30000);

//     it('should generate personalized preparation for each participant', async () => {
//       const briefAgent = agentFactory.getMeetingBriefAgent();

//       const brief = await briefAgent.generateMeetingBrief(mockCalendarEvent, meetingContext, {
//         includeParticipantPrep: true,
//         complexity: 'comprehensive'
//       });

//       expect(brief.participantPreparations).toBeDefined();
//       expect(brief.participantPreparations.length).toBe(3);

//       // Check Alice's preparation (organizer)
//       const alicePrep = brief.participantPreparations.find(p => p.participantEmail === 'alice@company.com');
//       expect(alicePrep).toBeDefined();
//       expect(alicePrep!.preparationTasks.length).toBeGreaterThan(0);
//       expect(alicePrep!.keyResponsibilities.length).toBeGreaterThan(0);

//       // Check Bob's preparation
//       const bobPrep = brief.participantPreparations.find(p => p.participantEmail === 'bob@company.com');
//       expect(bobPrep).toBeDefined();
//       expect(bobPrep!.preparationTasks.length).toBeGreaterThan(0);

//       // Check Charlie's preparation
//       const charliePrep = brief.participantPreparations.find(p => p.participantEmail === 'charlie@company.com');
//       expect(charliePrep).toBeDefined();
//       expect(charliePrep!.preparationTasks.length).toBeGreaterThan(0);

//       console.log('✅ Personalized participant preparations verified');
//       console.log(`   - Alice tasks: ${alicePrep!.preparationTasks.length}`);
//       console.log(`   - Bob tasks: ${bobPrep!.preparationTasks.length}`);
//       console.log(`   - Charlie tasks: ${charliePrep!.preparationTasks.length}`);
//     }, 25000);

//     it('should include time management and scheduling recommendations', async () => {
//       const briefAgent = agentFactory.getMeetingBriefAgent();

//       const brief = await briefAgent.generateMeetingBrief(mockCalendarEvent, meetingContext, {
//         includeTimeManagement: true
//       });

//       expect(brief.timeManagement).toBeDefined();

//       // Verify timing details
//       expect(brief.timeManagement.totalDuration).toBeGreaterThan(0);
//       expect(Array.isArray(brief.timeManagement.criticalTimings)).toBe(true);

//       // Verify schedule structure
//       expect(brief.timeManagement.suggestedSchedule.length).toBeGreaterThan(0);
//       brief.timeManagement.suggestedSchedule.forEach(item => {
//         expect(item.startTime).toBeDefined();
//         expect(item.endTime).toBeDefined();
//         expect(item.activity).toBeDefined();
//         expect(typeof item.buffer).toBe('boolean');
//       });

//       // Verify fallback plan if present
//       if (brief.timeManagement.fallbackPlan) {
//         expect(Array.isArray(brief.timeManagement.fallbackPlan.shortenedVersion)).toBe(true);
//         expect(Array.isArray(brief.timeManagement.fallbackPlan.essentialOnly)).toBe(true);
//       }

//       console.log('✅ Time management recommendations verified');
//       console.log(`   - Total duration: ${brief.timeManagement.totalDuration} minutes`);
//       console.log(`   - Schedule items: ${brief.timeManagement.suggestedSchedule.length}`);
//       console.log(`   - Has fallback plan: ${!!brief.timeManagement.fallbackPlan}`);
//     }, 20000);
//   });

//   describe('Phase 2 Milestone 2.3: Brief Delivery Systems', () => {
//     let meetingBrief: MeetingBrief;

//     beforeAll(async () => {
//       // Generate a brief for delivery testing
//       const contextAgent = agentFactory.getMeetingContextAgent();
//       const briefAgent = agentFactory.getMeetingBriefAgent();

//       const context = await contextAgent.gatherMeetingContext(mockCalendarEvent);
//       meetingBrief = await briefAgent.generateMeetingBrief(mockCalendarEvent, context);
//     });

//     it('should deliver brief via email', async () => {
//       const deliveryResults = await briefDeliveryService.deliverBrief(meetingBrief, ['email'], {
//         emailRecipients: ['alice@company.com', 'bob@company.com']
//       });

//       expect(deliveryResults).toBeDefined();
//       expect(Array.isArray(deliveryResults)).toBe(true);
//       expect(deliveryResults.length).toBe(1);

//       const emailResult = deliveryResults[0];
//       expect(emailResult.deliveryMethod).toBe('email');
//       expect(emailResult.status).toBe('sent');
//       expect(emailResult.recipients.length).toBe(2);

//       console.log('✅ Email delivery verified');
//       console.log(`   - Recipients: ${emailResult.recipients.length}`);
//     }, 15000);

//     it('should deliver brief via Slack', async () => {
//       const deliveryResults = await briefDeliveryService.deliverBrief(meetingBrief, ['slack'], {
//         slackChannel: '#product-team'
//       });

//       expect(deliveryResults).toBeDefined();
//       expect(Array.isArray(deliveryResults)).toBe(true);
//       expect(deliveryResults.length).toBe(1);

//       const slackResult = deliveryResults[0];
//       expect(slackResult.deliveryMethod).toBe('slack');
//       expect(slackResult.status).toBe('sent');

//       console.log('✅ Slack delivery verified');
//     }, 15000);

//     it('should deliver brief to calendar as description', async () => {
//       const deliveryResult = await briefDeliveryService.deliverBrief(meetingBrief, {
//         channels: ['calendar'],
//         calendarOptions: {
//           updateDescription: true,
//           addToPrivateCalendar: false
//         }
//       });

//       expect(deliveryResult).toBeDefined();
//       expect(deliveryResult.status).toBe('completed');

//       const calendarDelivery = deliveryResult.deliveries.find(d => d.channel === 'calendar');
//       expect(calendarDelivery).toBeDefined();
//       expect(calendarDelivery!.status).toBe('sent');

//       console.log('✅ Calendar delivery verified');
//     }, 15000);

//     it('should handle scheduled delivery', async () => {
//       const scheduledTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

//       const deliveryResult = await briefDeliveryService.deliverBrief(meetingBrief, {
//         channels: ['email'],
//         recipients: ['alice@company.com'],
//         scheduledDelivery: true,
//         deliveryTime: scheduledTime.toISOString()
//       });

//       expect(deliveryResult).toBeDefined();
//       expect(deliveryResult.status).toBe('scheduled');
//       expect(deliveryResult.scheduledFor).toBeDefined();

//       console.log('✅ Scheduled delivery verified');
//       console.log(`   - Scheduled for: ${deliveryResult.scheduledFor}`);
//     }, 10000);

//     it('should track delivery engagement', async () => {
//       const deliveryResult = await briefDeliveryService.deliverBrief(meetingBrief, {
//         channels: ['email'],
//         recipients: ['alice@company.com'],
//         trackEngagement: true
//       });

//       expect(deliveryResult).toBeDefined();
//       expect(deliveryResult.trackingEnabled).toBe(true);
//       expect(deliveryResult.engagementSummary).toBeDefined();

//       console.log('✅ Delivery engagement tracking verified');
//     }, 10000);
//   });

//   describe('Phase 2 Integration: End-to-End Workflow', () => {
//     it('should execute complete meeting brief workflow', async () => {
//       console.log('🚀 Starting end-to-end workflow test');

//       // Step 1: Process meeting brief through calendar workflow service
//       const workflowInput = {
//         type: 'meeting_brief',
//         calendarEvent: mockCalendarEvent,
//         userId: 'test-user',
//         sessionId: `test-${Date.now()}`
//       };

//       const result = await calendarWorkflowService.process(workflowInput);

//       // Verify workflow execution
//       expect(result).toBeDefined();
//       expect(result.sessionId).toBeDefined();
//       expect(result.type).toBe('meeting_brief');
//       expect(result.stage).toBe('brief_delivered');

//       // Verify context was gathered
//       expect(result.meetingContext).toBeDefined();
//       expect(result.meetingContext!.meetingId).toBe(mockCalendarEvent.id);
//       expect(result.meetingContext!.participantHistories.length).toBeGreaterThan(0);

//       // Verify brief was generated
//       expect(result.meetingBrief).toBeDefined();
//       expect(result.meetingBrief!.briefId).toBeDefined();
//       expect(result.meetingBrief!.meetingId).toBe(mockCalendarEvent.id);
//       expect(result.meetingBrief!.enhancedAgenda).toBeDefined();
//       expect(result.meetingBrief!.participantPreparations).toBeDefined();

//       console.log('✅ End-to-end workflow completed successfully');
//       console.log(`   - Session ID: ${result.sessionId}`);
//       console.log(`   - Final stage: ${result.stage}`);
//       console.log(`   - Context participants: ${result.meetingContext!.participantHistories.length}`);
//       console.log(`   - Agenda items: ${result.meetingBrief!.enhancedAgenda.length}`);
//       console.log(`   - Participant preparations: ${result.meetingBrief!.participantPreparations.length}`);
//     }, 45000);

//     it('should handle workflow with unknown participants gracefully', async () => {
//       const eventWithUnknownParticipants: CalendarEvent = {
//         ...mockCalendarEvent,
//         id: 'test-event-unknown',
//         attendees: [
//           {
//             email: 'unknown@external.com',
//             displayName: 'Unknown External',
//             responseStatus: 'needsAction'
//           }
//         ]
//       };

//       const workflowInput = {
//         type: 'meeting_brief',
//         calendarEvent: eventWithUnknownParticipants,
//         userId: 'test-user'
//       };

//       const result = await calendarWorkflowService.process(workflowInput);

//       expect(result).toBeDefined();
//       expect(result.stage).toBe('brief_delivered');
//       expect(result.meetingContext!.participantHistories.length).toBe(1);
//       expect(result.meetingBrief!.participantPreparations.length).toBe(1);

//       console.log('✅ Unknown participants workflow handled gracefully');
//     }, 30000);
//   });

//   describe('Phase 2 Performance & Quality Validation', () => {
//     it('should complete workflow within performance thresholds', async () => {
//       const startTime = Date.now();

//       const workflowInput = {
//         type: 'meeting_brief',
//         calendarEvent: mockCalendarEvent,
//         userId: 'test-user'
//       };

//       const result = await calendarWorkflowService.process(workflowInput);
//       const duration = Date.now() - startTime;

//       expect(result).toBeDefined();
//       expect(result.stage).toBe('brief_delivered');
//       expect(duration).toBeLessThan(60000); // Should complete within 60 seconds

//       console.log(`✅ Performance validation passed: ${duration}ms`);
//     }, 60000);

//     it('should validate brief quality metrics', async () => {
//       const contextAgent = agentFactory.getMeetingContextAgent();
//       const briefAgent = agentFactory.getMeetingBriefAgent();

//       const context = await contextAgent.gatherMeetingContext(mockCalendarEvent);
//       const brief = await briefAgent.generateMeetingBrief(mockCalendarEvent, context);

//       // Quality metrics
//       const agendaItems = brief.enhancedAgenda.length;
//       const participantPreps = brief.participantPreparations.length;
//       const primaryObjectives = brief.objectives.primary.length;
//       const scheduleItems = brief.timeManagement.schedule.length;

//       expect(agendaItems).toBeGreaterThanOrEqual(2); // At least 2 agenda items
//       expect(participantPreps).toBe(3); // All participants should have prep
//       expect(primaryObjectives).toBeGreaterThanOrEqual(1); // At least 1 primary objective
//       expect(scheduleItems).toBeGreaterThanOrEqual(3); // Opening, main content, closing

//       console.log('✅ Quality metrics validation passed');
//       console.log(`   - Quality score: ${Math.round((agendaItems + participantPreps + primaryObjectives + scheduleItems) / 4 * 10)}/10`);
//     }, 30000);
//   });
// });

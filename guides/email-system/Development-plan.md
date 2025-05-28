# Email Triage System Development Plan

Based on the **unified supervisor architecture** from our successful modular restructure and the email-triage-flow.md guide, here's the updated development plan for implementing the email triage system.

## Overview: Integration with Existing Supervisor Architecture

Our email triage system will integrate seamlessly with the existing **Master Supervisor Agent** and **Team Handler Registry** that we built during the modular restructure. The architecture follows our established pattern:

```
Master Supervisor Agent
├── Meeting Analysis Team (existing)
└── Email Triage Team (new) ← This development plan
    ├── Classification Worker
    ├── Summarization Worker  
    └── Reply-Draft Worker
```

**Key Integration Points:**
- **Existing**: `MasterSupervisorAgent`, `TeamHandlerRegistry`, `WorkflowFrameworkModule`
- **New**: `EmailAgentsModule`, `EmailWorkflowModule`, `EmailTriageController`
- **Leverage**: All existing RAG, LLM, and infrastructure services from our modular architecture

## Phase 1: Email Domain Modules Setup ✅ **COMPLETED**

### ✅ 1.1 Create EmailAgentsModule (Following MeetingAgentsModule Pattern) - **COMPLETED**

✅ **Successfully implemented:**
- EmailClassificationAgent with LLM-based priority and category classification  
- EmailSummarizationAgent with problem/context/ask extraction
- EmailReplyDraftAgent with template-based professional reply generation
- EmailAgentsModule with proper dependency injection and configuration
- All agent configuration factories with injection tokens
- Error handling and fallback responses

### ✅ 1.2 Create EmailWorkflowModule (Following MeetingWorkflowModule Pattern) - **COMPLETED** 

✅ **Successfully implemented:**
- EmailTriageManager that coordinates 3 workers in parallel execution
- EmailTriageService implementing TeamHandler interface 
- Integration with Master Supervisor via TeamHandlerRegistry
- EmailWorkflowModule with proper modular architecture
- Event emission for real-time progress tracking
- Comprehensive error handling and recovery

### ✅ 1.3 Register Email Team with Master Supervisor - **COMPLETED**

✅ **Successfully implemented:**
- EmailTriageService implements TeamHandler interface correctly
- Automatic registration with TeamHandlerRegistry on module initialization
- Team name: 'email_triage' with proper canHandle() validation
- Integration with existing Master Supervisor architecture
- No circular dependencies or module conflicts

**✅ Phase 1 Results:**
- ✅ Build passes successfully
- ✅ Clean modular architecture following established patterns
- ✅ Email triage team registered and ready for supervisor delegation
- ✅ Event-driven progress tracking implemented
- ✅ Comprehensive error handling and fallback mechanisms
- ✅ Ready for Phase 2 implementation

## Phase 2: Email Worker Agents Implementation ✅ **COMPLETED**

### ✅ 2.1 Classification Worker - **COMPLETED**
✅ **Successfully implemented:**
- EmailClassificationAgent with LLM-based priority and category classification
- JSON response parsing with fallback error handling
- Priority levels: urgent, high, normal, low
- Categories: bug_report, feature_request, question, complaint, praise, other
- Confidence scoring and reasoning explanation

### ✅ 2.2 Summarization Worker - **COMPLETED**
✅ **Successfully implemented:**
- EmailSummarizationAgent with problem/context/ask extraction
- Structured JSON output with problem, context, ask, and summary fields
- Configurable summary length limits
- Error handling with fallback responses

### ✅ 2.3 Reply Draft Worker - **COMPLETED**
✅ **Successfully implemented:**
- EmailReplyDraftAgent with template-based professional reply generation
- Dynamic template selection based on priority and category
- Personalized responses with sender name integration
- Professional tone with appropriate urgency levels
- Next steps suggestions for follow-up actions

### ✅ 2.4 Integration Testing - **COMPLETED**
✅ **Successfully tested:**
- EmailTriageController with POST /email/triage endpoint
- EmailModule integration with AppModule
- Master Supervisor routing to email_triage team
- End-to-end request processing through UnifiedWorkflowService
- Parallel execution of classification and summarization workers
- Sequential reply draft generation based on worker results

**✅ Phase 2 Results:**
- ✅ All worker agents implemented and tested
- ✅ HTTP endpoints responding correctly
- ✅ Master Supervisor delegation working
- ✅ Email triage team registered and processing requests
- ✅ JSON response formatting and error handling
- ✅ Ready for Phase 3 implementation

## Phase 3: Email Triage Manager & Graph Builder ✅ **COMPLETED**

### ✅ 3.1 Email Triage Manager (Coordinates Workers) - **COMPLETED**
✅ **Successfully implemented:**
- EmailTriageManager with parallel execution of classification and summarization
- Sequential reply draft generation based on worker results
- Event emission for real-time progress tracking
- Comprehensive error handling and recovery mechanisms
- UUID-based session management for request tracking

### ✅ 3.2 Email Triage Graph Builder (Following MeetingAnalysisGraphBuilder Pattern) - **COMPLETED**
✅ **Successfully implemented:**
- EmailTriageGraphBuilder with structured workflow nodes
- Graph-based execution flow: START → INITIALIZATION → PARALLEL_PROCESSING → COORDINATION → REPLY_DRAFT → FINALIZATION → END
- Node-based progress tracking with percentage completion
- Integration with EmailTriageManager for actual processing
- Error handling and logging throughout graph execution
- Extensible architecture for future workflow enhancements

### ✅ 3.3 Integration with WorkflowFrameworkModule - **COMPLETED**
✅ **Successfully implemented:**
- EmailTriageGraphBuilder added to EmailWorkflowModule
- Proper dependency injection and module exports
- Integration with existing workflow framework
- Build verification and testing completed

**✅ Phase 3 Results:**
- ✅ Graph-based workflow execution implemented
- ✅ Structured node progression with progress tracking
- ✅ Enhanced error handling and logging
- ✅ Parallel processing coordination working correctly
- ✅ Integration with existing Master Supervisor architecture
- ✅ Ready for Phase 4 implementation

## Phase 4: Zapier Webhook Integration (Week 3)

### 4.1 Email Webhook Controller (Integrates with Master Supervisor)
```typescript
// src/zapier/email-webhook.controller.ts
@Controller('webhook/email')
export class EmailWebhookController {
  constructor(
    private readonly unifiedWorkflowService: UnifiedWorkflowService, // Existing service
  ) {}

  @Post()
  @UseGuards(ZapierAuthGuard) // API key authentication
  async handleEmailWebhook(@Body() emailPayload: ZapierEmailPayload): Promise<any> {
    this.logger.log('Received email webhook from Zapier');
    
    // Transform Zapier payload to our unified format
    const input = {
      type: 'email_triage',
      emailData: {
        id: emailPayload.id,
        body: emailPayload.body,
        metadata: {
          subject: emailPayload.subject,
          from: emailPayload.from,
          to: emailPayload.to,
          timestamp: emailPayload.timestamp,
          headers: emailPayload.headers,
        },
      },
    };

    // Route through existing Master Supervisor
    return this.unifiedWorkflowService.processInput(
      input,
      emailPayload.metadata,
      emailPayload.userId, // User context
    );
  }
}
```

## Phase 5: Human Delegation Service (Week 4)

### 5.1 Understanding Delegation in Context

**Question**: *"What is the delegation service's purpose and do we need it with the supervisor teams approach?"*

**Answer**: **YES, we need both!** They serve different purposes:

1. **AI Agent Delegation** (Supervisor Teams): 
   - Master Supervisor routes work between AI teams (meeting analysis, email triage)
   - Automatic AI-to-AI task delegation
   - Already implemented in our architecture

2. **Human Delegation** (Delegation Service):
   - Users delegate emails to teammates/colleagues
   - Human-to-human task delegation
   - Triggered by user action: "Delegate to Teammate"
   - Supervisor spawns **Delegation Worker** that emails teammate

### 5.2 Delegation Worker (Part of Email Team)
```typescript
// src/email/agents/email-delegation.agent.ts
@Injectable()
export class EmailDelegationAgent {
  constructor(
    @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async delegateEmail(
    emailId: string,
    delegator: User,
    delegateTo: User,
    notes?: string,
  ): Promise<DelegationResult> {
    // 1. Get email and its triage results
    const email = await this.emailService.getEmailById(emailId);
    const triageResult = await this.emailTriageService.getTriageResult(emailId);

    // 2. Generate delegation summary using LLM
    const delegationSummary = await this.generateDelegationSummary(
      email,
      triageResult,
      delegator,
      notes,
    );

    // 3. Send email to teammate
    await this.emailService.sendEmail({
      to: delegateTo.email,
      subject: `Email Delegated: ${email.subject}`,
      body: delegationSummary.emailBody,
      from: delegator.email,
    });

    // 4. Create delegation record
    const delegation = await this.delegationRepository.create({
      emailId,
      delegatorId: delegator.id,
      delegateId: delegateTo.id,
      notes,
      summary: delegationSummary.summary,
      status: 'pending',
      createdAt: new Date(),
    });

    // 5. Notify via in-app notification
    await this.notificationService.sendNotification({
      userId: delegateTo.id,
      type: 'email_delegation',
      title: 'Email Delegated to You',
      message: `${delegator.name} delegated an email: "${email.subject}"`,
      data: { delegationId: delegation.id, emailId },
    });

    return delegation;
  }

  private async generateDelegationSummary(
    email: any,
    triageResult: any,
    delegator: User,
    notes?: string,
  ): Promise<any> {
    const prompt = `Generate a professional delegation email for:

Original Email:
- Subject: ${email.subject}
- From: ${email.from}
- Priority: ${triageResult.classification.priority}
- Summary: ${triageResult.summary.summary}

Delegator: ${delegator.name}
Notes: ${notes || 'No additional notes'}

Create a delegation email that:
1. Explains why it's being delegated
2. Provides context and summary
3. Suggests next steps
4. Is professional and helpful

Format as JSON:
{
  "summary": "Brief delegation summary",
  "emailBody": "Complete email body for teammate"
}`;

    const result = await this.llmService.generateCompletion({ prompt });
    return JSON.parse(result.content);
  }
}
```

## Phase 6: User Action Handlers (Week 4-5)

### 6.1 Email Action Controller
```typescript
// src/email/email-action.controller.ts
@Controller('api/email')
@UseGuards(JwtAuthGuard)
export class EmailActionController {
  constructor(
    private readonly emailService: EmailService,
    private readonly snoozeService: SnoozeService,
    private readonly emailDelegationAgent: EmailDelegationAgent, // Our new delegation agent
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
  ) {}

  @Post(':id/send')
  async sendReply(@Param('id') id: string, @Body() replyData: any, @Request() req: any) {
    // Route through supervisor to Email Send Worker
    return this.unifiedWorkflowService.processInput({
      type: 'email_send',
      emailId: id,
      replyData,
    }, {}, req.user.id);
  }

  @Post(':id/delegate')
  async delegateEmail(@Param('id') id: string, @Body() delegateData: any, @Request() req: any) {
    // Use our EmailDelegationAgent
    return this.emailDelegationAgent.delegateEmail(
      id,
      req.user, // delegator
      { id: delegateData.delegateToUserId, email: delegateData.delegateToEmail }, // delegatee
      delegateData.notes,
    );
  }

  @Post(':id/snooze') 
  async snoozeEmail(@Param('id') id: string, @Body() snoozeData: any, @Request() req: any) {
    // Route through supervisor to schedule re-trigger
    return this.unifiedWorkflowService.processInput({
      type: 'email_snooze',
      emailId: id,
      snoozeUntil: snoozeData.snoozeUntil,
    }, {}, req.user.id);
  }
}
```

## Phase 7: Update AppModule Integration (Week 5)

### 7.1 Add Email Modules to AppModule
```typescript
// src/app.module.ts
@Module({
  imports: [
    // Foundation Layer
    InfrastructureModule,
    
    // Core Services Layer
    LlmModule,
    VectorModule,
    
    // Platform Services Layer
    LanggraphCoreModule,
    RagCoreModule,
    AgentFrameworkModule,
    WorkflowFrameworkModule,
    
    // Domain Services Layer - Meeting
    MeetingAgentsModule,
    MeetingWorkflowModule,
    
    // Domain Services Layer - Email (NEW)
    EmailAgentsModule,
    EmailWorkflowModule,
    
    // Application Layer
    MeetingAnalysisModule,
    EmailTriageModule, // NEW
    
    // External modules
    AppConfigModule,
    LoggingModule,
    AuthModule,
    ZapierModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

## Implementation Timeline

| Week | Focus | Key Deliverables |
|------|-------|-----------------|
| 1 | Email Domain Setup | EmailAgentsModule, EmailWorkflowModule, Integration with Master Supervisor |
| 2 | Worker Agents | Classification, Summarization, Reply Draft agents |
| 3 | Triage Coordination | EmailTriageManager, Graph Builder, Zapier webhook integration |
| 4 | Human Delegation | EmailDelegationAgent, delegation workflow, snooze service |
| 5 | API Integration | Email action controllers, AppModule updates |
| 6 | Testing & Polish | End-to-end tests, documentation, deployment |

## Key Advantages of This Updated Approach

1. **Leverages Existing Architecture**: Reuses Master Supervisor, TeamHandlerRegistry, WorkflowFrameworkModule
2. **Consistent Module Pattern**: Follows same structure as MeetingAgentsModule/MeetingWorkflowModule  
3. **Clean Separation**: AI delegation (supervisor teams) vs Human delegation (delegation service)
4. **RAG Ready**: Can enhance with RAG capabilities using existing RagCoreModule
5. **Scalable**: Easy to add more email workers (spam detection, sentiment analysis, etc.)
6. **Unified API**: All workflows route through UnifiedWorkflowService

This plan builds on our successful modular restructure while implementing the email triage system exactly as specified in the email-triage-flow.md guide!

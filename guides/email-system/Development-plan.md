
# Email Triage System Development Plan

Based on the unified supervisor architecture in the migration guide, here's the complete development plan for implementing the email triage system.

## Phase 1: Email Worker Agents Implementation (Week 1)

1. **Classification Worker**
   - Implement `src/langgraph/agents/email-triage/workers/classification.worker.ts`
   - Classify emails by priority (urgent, high, normal, low) and category
   - Extract meaningful classification reasoning

2. **Summarization Worker**
   - Implement `src/langgraph/agents/email-triage/workers/summarization.worker.ts`
   - Create concise summaries capturing main points and requests
   - Optimize for clarity and brevity

3. **Reply Draft Worker**
   - Implement `src/langgraph/agents/email-triage/workers/reply-draft.worker.ts`
   - Generate contextually appropriate reply templates
   - Personalize based on sender and content

## Phase 2: Zapier Webhook Integration (Week 2)

1. **Email Webhook Controller**
   - Implement `src/zapier/webhook.controller.ts`
   - Configure webhook authentication with API key guard
   - Process incoming email payloads

2. **Email Event Service**
   - Implement `src/email/events/email-event.service.ts`
   - Format and normalize email data
   - Process emails through LangGraph service
   - Store results in database

3. **Zapier Integration Configuration**
   - Set up Zapier account and create new Zap
   - Configure Gmail/Outlook trigger
   - Set up webhook action pointing to the API

## Phase 3: Result Storage and User Action Handlers (Week 3)

1. **Email Triage Result Service**
   - Implement `src/email/triage/triage-result.service.ts`
   - Create database entity and repository
   - Implement CRUD operations for triage results

2. **Email Action Controller**
   - Complete implementation of `src/email/email-action.controller.ts`:

```typescript
@Controller('api/email')
@UseGuards(AuthGuard('jwt'))
export class EmailActionController {
  private readonly logger = new Logger(EmailActionController.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly snoozeService: SnoozeService,
    private readonly delegationService: DelegationService,
  ) {}

  @Post(':id/send')
  async sendReply(@Param('id') id: string, @Body() replyData: any) {
    this.logger.log(`Sending reply for email: ${id}`);
    try {
      const result = await this.emailService.sendEmail(replyData.userId, replyData.provider, {
        inReplyTo: id,
        subject: replyData.subject || `Re: ${replyData.originalSubject}`,
        to: [replyData.to],
        body: replyData.body,
      });
      return { success: true, sent: result };
    } catch (error) {
      this.logger.error(`Error sending email reply: ${error.message}`);
      throw error;
    }
  }

  @Post(':id/snooze')
  async snoozeEmail(@Param('id') id: string, @Body() snoozeData: any) {
    this.logger.log(`Snoozing email: ${id} until ${snoozeData.snoozeUntil}`);
    try {
      const result = await this.snoozeService.snoozeEmail(
        snoozeData.userId,
        snoozeData.provider,
        id,
        snoozeData.snoozeUntil,
        snoozeData.reason,
      );
      return { success: true, snooze: result };
    } catch (error) {
      this.logger.error(`Error snoozing email: ${error.message}`);
      throw error;
    }
  }

  @Post(':id/delegate')
  async delegateEmail(@Param('id') id: string, @Body() delegateData: any) {
    this.logger.log(`Delegating email: ${id} to ${delegateData.delegateTo}`);
    try {
      const result = await this.delegationService.delegateEmail(
        delegateData.userId,
        id,
        delegateData.provider,
        delegateData.delegateTo,
        delegateData.notes,
      );
      return { success: true, delegation: result };
    } catch (error) {
      this.logger.error(`Error delegating email: ${error.message}`);
      throw error;
    }
  }
}
```

3. **Snooze Service**
   - Implement `src/email/snooze/snooze.service.ts`:

```typescript
@Injectable()
export class SnoozeService {
  private readonly logger = new Logger(SnoozeService.name);
  private readonly schedulerRegistry: SchedulerRegistry;
  private readonly snoozedEmails = new Map<string, any>();

  constructor(
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async snoozeEmail(
    userId: string,
    provider: string,
    emailId: string,
    snoozeUntil: Date | string,
    reason?: string,
  ): Promise<any> {
    // Convert string to Date if necessary
    const snoozeDate = typeof snoozeUntil === 'string' ? new Date(snoozeUntil) : snoozeUntil;
    
    // Validate snooze date is in the future
    if (snoozeDate.getTime() <= Date.now()) {
      throw new Error('Snooze time must be in the future');
    }
    
    // Create snooze record
    const snoozeId = `snooze-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const snoozeRecord = {
      id: snoozeId,
      userId,
      provider,
      emailId,
      snoozeUntil: snoozeDate,
      reason,
      createdAt: new Date(),
    };
    
    // Store snooze record
    this.snoozedEmails.set(snoozeId, snoozeRecord);
    
    // Update email metadata
    await this.emailService.updateEmailMetadata(userId, provider, emailId, {
      snoozed: true,
      snoozeId,
      snoozeUntil: snoozeDate.toISOString(),
    });
    
    // Schedule the reminder
    this.scheduleReminder(snoozeRecord);
    
    return snoozeRecord;
  }
  
  private scheduleReminder(snoozeRecord: any): void {
    const timeoutName = `snooze-${snoozeRecord.id}`;
    const now = Date.now();
    const snoozeTime = snoozeRecord.snoozeUntil.getTime();
    const delay = snoozeTime - now;
    
    // Create timeout
    const timeout = setTimeout(() => {
      this.handleSnoozeExpiration(snoozeRecord);
    }, delay);
    
    // Register timeout with Nest.js scheduler
    this.schedulerRegistry.addTimeout(timeoutName, timeout);
  }
  
  private async handleSnoozeExpiration(snoozeRecord: any): Promise<void> {
    // Update email metadata
    await this.emailService.updateEmailMetadata(
      snoozeRecord.userId,
      snoozeRecord.provider,
      snoozeRecord.emailId,
      {
        snoozed: false,
        unsnoozedAt: new Date().toISOString(),
      }
    );
    
    // Notify user
    await this.notificationService.sendNotification({
      userId: snoozeRecord.userId,
      type: 'email_unsnooze',
      title: 'Email Reminder',
      message: `Your snoozed email is now back in your inbox.`,
      data: {
        emailId: snoozeRecord.emailId,
        snoozeId: snoozeRecord.id,
      },
    });
  }
}
```

4. **Delegation Service**
   - Implement `src/email/delegation/delegation.service.ts`:

```typescript
@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);
  private readonly delegations = new Map<string, any>();

  constructor(
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async delegateEmail(
    userId: string,
    emailId: string,
    provider: string,
    delegateTo: string,
    notes?: string,
  ): Promise<any> {
    // Fetch the email
    const email = await this.emailService.getEmail(userId, provider, emailId);
    
    // Create delegation record
    const delegationId = `delegation-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const delegation = {
      id: delegationId,
      userId,
      emailId,
      provider,
      delegatedTo: delegateTo,
      notes,
      status: 'pending',
      createdAt: new Date(),
      email: {
        id: emailId,
        subject: email.subject,
        snippet: email.body?.substring(0, 100) + '...',
      },
    };
    
    // Store delegation record
    this.delegations.set(delegationId, delegation);
    
    // Update email metadata
    await this.emailService.updateEmailMetadata(userId, provider, emailId, {
      delegated: true,
      delegationId,
      delegatedTo,
      delegatedAt: new Date().toISOString(),
    });
    
    // Notify delegate
    await this.notificationService.sendNotification({
      userId: delegateTo,
      type: 'email_delegation',
      title: 'Email Delegated to You',
      message: `${userId} has delegated an email to you: "${email.subject}"`,
      data: {
        delegationId,
        emailId,
        subject: email.subject,
      },
    });
    
    return delegation;
  }

  async acceptDelegation(delegationId: string): Promise<any> {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) {
      throw new Error(`Delegation not found: ${delegationId}`);
    }
    
    // Update delegation status
    delegation.status = 'accepted';
    delegation.acceptedAt = new Date();
    this.delegations.set(delegationId, delegation);
    
    // Notify original user
    await this.notificationService.sendNotification({
      userId: delegation.userId,
      type: 'delegation_accepted',
      title: 'Delegation Accepted',
      message: `${delegation.delegatedTo} has accepted your email delegation.`,
      data: {
        delegationId,
        emailId: delegation.emailId,
      },
    });
    
    return delegation;
  }

  async rejectDelegation(delegationId: string, reason?: string): Promise<any> {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) {
      throw new Error(`Delegation not found: ${delegationId}`);
    }
    
    // Update delegation status
    delegation.status = 'rejected';
    delegation.rejectedAt = new Date();
    delegation.rejectionReason = reason;
    this.delegations.set(delegationId, delegation);
    
    // Notify original user
    await this.notificationService.sendNotification({
      userId: delegation.userId,
      type: 'delegation_rejected',
      title: 'Delegation Rejected',
      message: `${delegation.delegatedTo} has rejected your email delegation.`,
      data: {
        delegationId,
        emailId: delegation.emailId,
        reason,
      },
    });
    
    return delegation;
  }
}
```

## Phase 4: Notification System (Week 4)

1. **Notification Service**
   - Implement `src/notifications/notification.service.ts`:

```typescript
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private readonly websocketGateway: WebsocketGateway,
  ) {}
  
  async sendNotification(notificationData: any): Promise<Notification> {
    try {
      // Create notification record
      const notification = this.notificationRepository.create({
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data,
        read: false,
        createdAt: new Date(),
      });
      
      // Save to database
      const savedNotification = await this.notificationRepository.save(notification);
      
      // Send real-time notification if user is connected
      this.websocketGateway.sendNotificationToUser(
        notificationData.userId,
        savedNotification,
      );
      
      return savedNotification;
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
      throw error;
    }
  }
  
  async getNotificationsForUser(userId: string, options: any = {}): Promise<Notification[]> {
    try {
      const query = this.notificationRepository.createQueryBuilder('notification')
        .where('notification.userId = :userId', { userId });
      
      // Filter by read status if specified
      if (options.read !== undefined) {
        query.andWhere('notification.read = :read', { read: options.read });
      }
      
      // Apply sorting
      query.orderBy('notification.createdAt', 'DESC');
      
      // Apply pagination
      if (options.limit) {
        query.take(options.limit);
      }
      
      if (options.offset) {
        query.skip(options.offset);
      }
      
      return await query.getMany();
    } catch (error) {
      this.logger.error(`Failed to get notifications: ${error.message}`);
      throw error;
    }
  }
  
  async markAsRead(notificationId: string): Promise<Notification> {
    try {
      const notification = await this.notificationRepository.findOneOrFail({ where: { id: notificationId } });
      notification.read = true;
      notification.readAt = new Date();
      return await this.notificationRepository.save(notification);
    } catch (error) {
      this.logger.error(`Failed to mark notification as read: ${error.message}`);
      throw error;
    }
  }
}
```

2. **Websocket Gateway**
   - Implement `src/notifications/websocket.gateway.ts`:

```typescript
@WebSocketGateway({ cors: true })
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebsocketGateway.name);
  private readonly userSockets = new Map<string, Socket[]>();

  @WebSocketServer() server: Server;

  handleConnection(client: Socket, ...args: any[]): void {
    const userId = client.handshake.query.userId as string;
    if (!userId) {
      client.disconnect();
      return;
    }
    
    // Store client connection
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, []);
    }
    this.userSockets.get(userId).push(client);
    
    this.logger.log(`Client connected: ${userId}, total connections: ${this.userSockets.get(userId).length}`);
  }

  handleDisconnect(client: Socket): void {
    const userId = client.handshake.query.userId as string;
    if (!userId) return;
    
    // Remove client connection
    const userConnections = this.userSockets.get(userId) || [];
    const updatedConnections = userConnections.filter(socket => socket.id !== client.id);
    
    if (updatedConnections.length > 0) {
      this.userSockets.set(userId, updatedConnections);
    } else {
      this.userSockets.delete(userId);
    }
    
    this.logger.log(`Client disconnected: ${userId}, remaining connections: ${updatedConnections.length}`);
  }

  sendNotificationToUser(userId: string, notification: any): void {
    const userConnections = this.userSockets.get(userId) || [];
    
    if (userConnections.length > 0) {
      // Emit notification to all user's connections
      userConnections.forEach(socket => {
        socket.emit('notification', notification);
      });
      
      this.logger.log(`Notification sent to user ${userId} (${userConnections.length} connections)`);
    } else {
      this.logger.log(`User ${userId} not connected, notification will be shown on next login`);
    }
  }
}
```

## Phase 5: Frontend Integration (Week 5)

1. **Email Triage API Controller**
   - Implement `src/email/email-triage.controller.ts`:

```typescript
@Controller('api/email-triage')
@UseGuards(AuthGuard('jwt'))
export class EmailTriageController {
  private readonly logger = new Logger(EmailTriageController.name);

  constructor(
    private readonly triageResultService: EmailTriageResultService,
  ) {}

  @Get()
  async getTriageResults(
    @Query() query: any,
    @Request() req: any,
  ): Promise<any> {
    const userId = req.user.id;
    
    // Add user filter
    const options = {
      ...query,
      userId,
    };
    
    return this.triageResultService.getTriageResults(options);
  }

  @Get(':id')
  async getTriageResult(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<any> {
    const result = await this.triageResultService.getTriageResultById(id);
    
    // Check if user has access to this result
    if (result.userId !== req.user.id) {
      throw new UnauthorizedException('You do not have access to this triage result');
    }
    
    return result;
  }
}
```

2. **Frontend API Client**
   - Implement API client for frontend to interact with email triage system
   - Create methods for retrieving triage results and performing actions

3. **Email Triage Dashboard Components**
   - Implement UI components for displaying triaged emails
   - Create views for different priority levels
   - Add action buttons for reply, snooze, and delegate

## Phase 6: Testing and Deployment (Week 6)

1. **Unit Tests**
   - Write unit tests for all services and controllers
   - Test email worker agents with sample emails
   - Test Zapier webhook integration

2. **Integration Tests**
   - Set up end-to-end tests for the complete email triage flow
   - Test real-time notifications
   - Test user actions (reply, snooze, delegate)

3. **Deployment Configuration**
   - Set up environment variables for production
   - Configure database connections
   - Set up monitoring and logging

4. **Documentation**
   - Create API documentation
   - Write user guides for the email triage system
   - Document the architecture and component interactions

## Implementation Timeline

| Week | Focus | Key Deliverables |
|------|-------|-----------------|
| 1 | Email Worker Agents | Classification, Summarization, and Reply Draft workers |
| 2 | Zapier Integration | Webhook controller, Email event service, Zapier setup |
| 3 | User Actions | Result storage, Email actions API, Snooze and Delegation services |
| 4 | Notifications | Notification service, WebSocket gateway |
| 5 | Frontend | API controllers, Frontend components |
| 6 | Testing & Deployment | Tests, Deployment configuration, Documentation |

## Next Steps

After completing this development plan, future enhancements could include:

1. **Advanced Classification**: Implement machine learning models for more accurate email classification
2. **Smart Scheduling**: Add calendar integration for scheduling follow-ups
3. **Analytics Dashboard**: Create reports on email volume, response times, and team performance
4. **Multi-language Support**: Add support for processing emails in multiple languages
5. **Integration with CRM**: Connect email triage system with CRM for better customer context

This development plan will deliver a complete email triage system built on the unified supervisor architecture, allowing for seamless integration with other AI agent workflows.

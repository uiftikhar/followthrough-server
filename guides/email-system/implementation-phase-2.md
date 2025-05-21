# Implementation Plan: Email Triage System

## Introduction

This implementation guide outlines the development plan for the second phase of FollowThrough AI:
2. Email Triage System

We'll leverage our existing LangGraph architecture, enhancing it with Model Context Protocol (MCP) for external integrations and Zapier for connecting with email and task management services.


## Phase 2: Email Triage System (Weeks 7-12)

### Week 7-8: Email Classification & Prioritization

#### 1. Email Classification Service

**Files to Create:**
- `src/email/classification/email-classifier.service.ts`
- `src/email/classification/classification-models/priority-classifier.model.ts`
- `src/email/classification/classification-models/category-classifier.model.ts`
- `src/email/classification/models/email-category.enum.ts`
- `src/email/classification/models/email-priority.enum.ts`

**Email Category Enum Implementation:**

```typescript
// src/email/classification/models/email-category.enum.ts
export enum EmailCategory {
  PERSONAL = 'personal',
  WORK = 'work',
  FINANCE = 'finance',
  SHOPPING = 'shopping',
  TRAVEL = 'travel',
  SOCIAL = 'social',
  UPDATES = 'updates',
  PROMOTIONS = 'promotions',
  NEWSLETTERS = 'newsletters',
  INFORMATION = 'information',
  REQUEST = 'request',
  ACTION_REQUIRED = 'action_required',
  SCHEDULING = 'scheduling',
  CONFIRMATION = 'confirmation',
  OTHER = 'other',
}
```

**Email Priority Enum Implementation:**

```typescript
// src/email/classification/models/email-priority.enum.ts
export enum EmailPriority {
  URGENT = 'urgent',
  IMPORTANT = 'important',
  NORMAL = 'normal',
  LOW = 'low',
}
```

**Email Classifier Implementation:**

```typescript
// src/email/classification/email-classifier.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../langgraph/llm/llm.service';
import { Email } from '../models/email.model';
import { EmailCategory } from './models/email-category.enum';
import { EmailPriority } from './models/email-priority.enum';

@Injectable()
export class EmailClassifierService {
  private readonly logger = new Logger(EmailClassifierService.name);

  constructor(
    private llmService: LlmService,
  ) {}

  async classifyEmail(email: Email): Promise<{
    category: EmailCategory;
    priority: EmailPriority;
    confidence: number;
  }> {
    try {
      const model = this.llmService.getChatModel({
        temperature: 0.1,
        model: 'gpt-4o',
      });
      
      const prompt = `
      Analyze this email and classify it by category and priority.
      
      From: ${email.from.name} <${email.from.address}>
      To: ${email.to.map(to => `${to.name} <${to.address}>`).join(', ')}
      ${email.cc ? `CC: ${email.cc.map(cc => `${cc.name} <${cc.address}>`).join(', ')}` : ''}
      Subject: ${email.subject}
      
      ${email.body}
      
      Return a JSON object with these fields:
      - category: One of [${Object.values(EmailCategory).join(', ')}]
      - priority: One of [${Object.values(EmailPriority).join(', ')}]
      - confidence: A number between 0 and 1 representing confidence in the classification
      - reasoning: A brief explanation of your classification
      `;
      
      const response = await model.invoke([
        {
          role: 'system',
          content: 'You are an email classification assistant. Analyze emails and classify them by category and priority.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);
      
      const content = response.content.toString();
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                        content.match(/```\n([\s\S]*?)\n```/) ||
                        content.match(/(\{[\s\S]*\})/);
      
      if (!jsonMatch) {
        throw new Error('Failed to parse classification response');
      }
      
      const classification = JSON.parse(jsonMatch[1]);
      
      // Update email metadata with classification
      email.metadata = {
        ...email.metadata,
        classification: {
          category: classification.category,
          priority: classification.priority,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
          classifiedAt: new Date().toISOString(),
        },
      };
      
      return {
        category: classification.category,
        priority: classification.priority,
        confidence: classification.confidence,
      };
    } catch (error) {
      this.logger.error(`Failed to classify email: ${error.message}`);
      throw error;
    }
  }

# Phase 2: Email Triage System (Weeks 7-12) - Continued Implementation

## Week 7-8: Email Classification & Prioritization (Continued)

### 1. Complete Email Classifier Implementation

```typescript
// src/email/classification/email-classifier.service.ts (continued)
  async bulkClassifyEmails(emails: Email[]): Promise<Email[]> {
    try {
      // Process emails in parallel, but with a concurrency limit
      const concurrencyLimit = 5;
      const results: Email[] = [];
      
      for (let i = 0; i < emails.length; i += concurrencyLimit) {
        const batch = emails.slice(i, i + concurrencyLimit);
        const batchResults = await Promise.all(
          batch.map(async email => {
            try {
              await this.classifyEmail(email);
              return email;
            } catch (error) {
              this.logger.error(`Failed to classify email ${email.id}: ${error.message}`);
              return email; // Return original email even if classification fails
            }
          })
        );
        
        results.push(...batchResults);
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Failed to bulk classify emails: ${error.message}`);
      throw error;
    }
  }
}
```

### 2. Implement Priority Scoring System

**Files to Create:**
- `src/email/prioritization/priority-scorer.service.ts`
- `src/email/prioritization/scoring-rules/base-scoring-rule.ts`
- `src/email/prioritization/scoring-rules/sender-rule.ts`
- `src/email/prioritization/scoring-rules/content-rule.ts`
- `src/email/prioritization/scoring-rules/urgency-rule.ts`

**Priority Scorer Implementation:**

```typescript
// src/email/prioritization/priority-scorer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Email } from '../models/email.model';
import { BaseScoringRule } from './scoring-rules/base-scoring-rule';
import { SenderRule } from './scoring-rules/sender-rule';
import { ContentRule } from './scoring-rules/content-rule';
import { UrgencyRule } from './scoring-rules/urgency-rule';

interface PriorityScore {
  score: number;
  reasons: string[];
}

@Injectable()
export class PriorityScorerService {
  private readonly logger = new Logger(PriorityScorerService.name);
  private readonly rules: BaseScoringRule[];

  constructor(
    private senderRule: SenderRule,
    private contentRule: ContentRule,
    private urgencyRule: UrgencyRule,
  ) {
    this.rules = [
      this.senderRule,
      this.contentRule,
      this.urgencyRule,
    ];
  }

  async scoreEmail(email: Email, userId: string): Promise<PriorityScore> {
    try {
      let totalScore = 0;
      const reasons: string[] = [];
      
      // Apply each rule
      for (const rule of this.rules) {
        const ruleResult = await rule.apply(email, userId);
        totalScore += ruleResult.score;
        
        if (ruleResult.reason) {
          reasons.push(ruleResult.reason);
        }
      }
      
      // Normalize score to 0-100 range
      const normalizedScore = Math.min(Math.max(totalScore, 0), 100);
      
      // Update email metadata with priority score
      email.metadata = {
        ...email.metadata,
        priorityScore: {
          score: normalizedScore,
          reasons,
          timestamp: new Date().toISOString(),
        },
      };
      
      return {
        score: normalizedScore,
        reasons,
      };
    } catch (error) {
      this.logger.error(`Failed to score email: ${error.message}`);
      return {
        score: 0,
        reasons: [`Failed to calculate score: ${error.message}`],
      };
    }
  }

  async bulkScoreEmails(emails: Email[], userId: string): Promise<Email[]> {
    try {
      const scoredEmails = await Promise.all(
        emails.map(async email => {
          await this.scoreEmail(email, userId);
          return email;
        })
      );
      
      // Sort by priority score (highest first)
      return scoredEmails.sort((a, b) => {
        const scoreA = a.metadata?.priorityScore?.score || 0;
        const scoreB = b.metadata?.priorityScore?.score || 0;
        return scoreB - scoreA;
      });
    } catch (error) {
      this.logger.error(`Failed to bulk score emails: ${error.message}`);
      return emails; // Return original emails even if scoring fails
    }
  }
}
```

### 3. Email Triage Controller and Service

**Files to Create:**
- `src/email/triage/triage.module.ts`
- `src/email/triage/triage.service.ts`
- `src/email/triage/triage.controller.ts`
- `src/email/triage/dtos/triage-result.dto.ts`
- `src/email/triage/dtos/triage-request.dto.ts`

**Triage Service Implementation:**

```typescript
// src/email/triage/triage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Email } from '../models/email.model';
import { EmailService } from '../email.service';
import { EmailClassifierService } from '../classification/email-classifier.service';
import { PriorityScorerService } from '../prioritization/priority-scorer.service';
import { EmailProcessorService } from '../processors/email-processor.service';

interface TriageOptions {
  maxEmails?: number;
  includeProcessed?: boolean;
  priorityThreshold?: number;
}

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private emailService: EmailService,
    private emailClassifier: EmailClassifierService,
    private priorityScorer: PriorityScorerService,
    private emailProcessor: EmailProcessorService,
  ) {}

  async triageUserInbox(
    userId: string, 
    provider: string,
    options: TriageOptions = {},
  ): Promise<{
    urgent: Email[];
    important: Email[];
    normal: Email[];
    low: Email[];
  }> {
    try {
      // Fetch emails
      const fetchOptions: any = {
        limit: options.maxEmails || 50,
        unreadOnly: true,
      };
      
      const emails = await this.emailService.getEmails(userId, provider, fetchOptions);
      
      // Filter out already processed emails if requested
      const emailsToProcess = options.includeProcessed
        ? emails
        : emails.filter(email => !email.metadata?.processed);
      
      // Process emails - extract entities, intents, etc.
      const processedEmails = await Promise.all(
        emailsToProcess.map(email => this.emailProcessor.processEmail(email))
      );
      
      // Classify emails
      const classifiedEmails = await this.emailClassifier.bulkClassifyEmails(processedEmails);
      
      // Score and prioritize emails
      const scoredEmails = await this.priorityScorer.bulkScoreEmails(classifiedEmails, userId);
      
      // Group emails by priority
      const priorityThreshold = options.priorityThreshold || 0;
      const groupedEmails = this.groupEmailsByPriority(
        scoredEmails.filter(email => {
          const score = email.metadata?.priorityScore?.score || 0;
          return score >= priorityThreshold;
        })
      );
      
      return groupedEmails;
    } catch (error) {
      this.logger.error(`Failed to triage inbox: ${error.message}`);
      throw error;
    }
  }
  
  private groupEmailsByPriority(emails: Email[]): {
    urgent: Email[];
    important: Email[];
    normal: Email[];
    low: Email[];
  } {
    const result = {
      urgent: [],
      important: [],
      normal: [],
      low: [],
    };
    
    for (const email of emails) {
      const score = email.metadata?.priorityScore?.score || 0;
      
      if (score >= 80) {
        result.urgent.push(email);
      } else if (score >= 60) {
        result.important.push(email);
      } else if (score >= 30) {
        result.normal.push(email);
      } else {
        result.low.push(email);
      }
    }
    
    return result;
  }
}
```

**Triage Module Implementation:**

```typescript
// src/email/triage/triage.module.ts
import { Module } from '@nestjs/common';
import { TriageService } from './triage.service';
import { TriageController } from './triage.controller';
import { EmailModule } from '../email.module';
import { EmailClassifierModule } from '../classification/email-classifier.module';
import { PrioritizationModule } from '../prioritization/prioritization.module';

@Module({
  imports: [
    EmailModule,
    EmailClassifierModule,
    PrioritizationModule,
  ],
  controllers: [TriageController],
  providers: [TriageService],
  exports: [TriageService],
})
export class TriageModule {}
```

## Week 9-10: Response Generation

### 1. Email Response Generator

**Files to Create:**
- `src/email/responses/response-generator.service.ts`
- `src/email/responses/response-templates.service.ts`
- `src/email/responses/models/response-template.model.ts`
- `src/email/responses/models/response-type.enum.ts`

**Response Generator Implementation:**

```typescript
// src/email/responses/response-generator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../langgraph/llm/llm.service';
import { Email } from '../models/email.model';
import { Thread } from '../models/thread.model';
import { ResponseTemplatesService } from './response-templates.service';
import { ResponseType } from './models/response-type.enum';

@Injectable()
export class ResponseGeneratorService {
  private readonly logger = new Logger(ResponseGeneratorService.name);

  constructor(
    private llmService: LlmService,
    private templatesService: ResponseTemplatesService,
  ) {}

  async generateResponse(
    email: Email,
    thread?: Thread,
    responseType: ResponseType = ResponseType.STANDARD,
  ): Promise<string> {
    try {
      // Get template for the response type
      const template = await this.templatesService.getTemplate(responseType);
      
      // Generate response based on template and context
      const model = this.llmService.getChatModel({
        temperature: 0.7,
        model: 'gpt-4o',
      });
      
      const threadContext = thread 
        ? this.prepareThreadContext(thread)
        : '';
      
      const prompt = `
      Generate a professional email response to the following email:
      
      From: ${email.from.name} <${email.from.address}>
      Subject: ${email.subject}
      
      ${email.body}
      
      ${threadContext ? `Previous conversation context:\n${threadContext}\n` : ''}
      
      Use this template structure as a guide:
      ${template.content}
      
      Response tone: ${template.tone || 'professional'}
      Response length: ${template.lengthPreference || 'concise'}
      
      Craft a complete response that directly addresses the specific content of the email.
      `;
      
      const response = await model.invoke([
        {
          role: 'system',
          content: 'You are an email assistant that writes professional, contextually appropriate email responses.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);
      
      return response.content.toString();
    } catch (error) {
      this.logger.error(`Failed to generate response: ${error.message}`);
      throw error;
    }
  }
  
  private prepareThreadContext(thread: Thread): string {
    // Extract previous messages (excluding the most recent one)
    const previousMessages = thread.emails.slice(0, -1);
    
    if (previousMessages.length === 0) {
      return '';
    }
    
    // Format the context
    return previousMessages.map(email => {
      return `[${new Date(email.date).toLocaleString()}] ${email.from.name}: ${email.body.substring(0, 200)}${email.body.length > 200 ? '...' : ''}`;
    }).join('\n\n');
  }

  async generateBriefSummary(email: Email): Promise<string> {
    try {
      const model = this.llmService.getChatModel({
        temperature: 0.3,
        model: 'gpt-4o',
      });
      
      const prompt = `
      Summarize this email in one sentence (maximum 20 words):
      
      Subject: ${email.subject}
      
      ${email.body}
      `;
      
      const response = await model.invoke([
        {
          role: 'system',
          content: 'You are an email summarization assistant. Create extremely concise, accurate summaries.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);
      
      return response.content.toString();
    } catch (error) {
      this.logger.error(`Failed to generate brief summary: ${error.message}`);
      return 'Failed to generate summary';
    }
  }
}
```

### 2. Email Delegation Workflow

**Files to Create:**
- `src/email/delegation/delegation.service.ts`
- `src/email/delegation/models/delegation-request.model.ts`
- `src/email/delegation/models/delegation-status.enum.ts`

**Delegation Service Implementation:**

```typescript
// src/email/delegation/delegation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Email } from '../models/email.model';
import { EmailService } from '../email.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { DelegationRequest } from './models/delegation-request.model';
import { DelegationStatus } from './models/delegation-status.enum';

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);
  private readonly delegations = new Map<string, DelegationRequest>();

  constructor(
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async delegateEmail(
    userId: string,
    emailId: string,
    provider: string,
    delegateTo: string,
    notes?: string,
  ): Promise<DelegationRequest> {
    try {
      // Fetch the email
      const email = await this.emailService.getEmail(userId, provider, emailId);
      
      // Create delegation request
      const delegationId = `delegation-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      const delegationRequest: DelegationRequest = {
        id: delegationId,
        emailId,
        fromUserId: userId,
        toUserId: delegateTo,
        status: DelegationStatus.PENDING,
        notes,
        createdAt: new Date().toISOString(),
        email: {
          id: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date,
        },
      };
      
      // Store the delegation request
      this.delegations.set(delegationId, delegationRequest);
      
      // Notify the delegate
      await this.notificationsService.sendNotification(
        delegateTo,
        {
          type: 'email_delegation',
          title: 'Email Delegation Request',
          body: `${userId} has delegated an email to you: "${email.subject}"`,
          actionUrl: `/email/delegations/${delegationId}`,
          data: {
            delegationId,
            emailId: email.id,
            subject: email.subject,
          },
        }
      );
      
      return delegationRequest;
    } catch (error) {
      this.logger.error(`Failed to delegate email: ${error.message}`);
      throw error;
    }
  }

  async acceptDelegation(delegationId: string): Promise<DelegationRequest> {
    try {
      const delegation = this.delegations.get(delegationId);
      if (!delegation) {
        throw new Error(`Delegation request not found: ${delegationId}`);
      }
      
      // Update delegation status
      delegation.status = DelegationStatus.ACCEPTED;
      delegation.updatedAt = new Date().toISOString();
      
      // Store updated delegation
      this.delegations.set(delegationId, delegation);
      
      // Notify the original user
      await this.notificationsService.sendNotification(
        delegation.fromUserId,
        {
          type: 'delegation_accepted',
          title: 'Delegation Accepted',
          body: `${delegation.toUserId} has accepted your email delegation: "${delegation.email.subject}"`,
          data: {
            delegationId,
            emailId: delegation.emailId,
            subject: delegation.email.subject,
          },
        }
      );
      
      return delegation;
    } catch (error) {
      this.logger.error(`Failed to accept delegation: ${error.message}`);
      throw error;
    }
  }

  async rejectDelegation(delegationId: string, reason?: string): Promise<DelegationRequest> {
    try {
      const delegation = this.delegations.get(delegationId);
      if (!delegation) {
        throw new Error(`Delegation request not found: ${delegationId}`);
      }
      
      // Update delegation status
      delegation.status = DelegationStatus.REJECTED;
      delegation.updatedAt = new Date().toISOString();
      delegation.rejectionReason = reason;
      
      // Store updated delegation
      this.delegations.set(delegationId, delegation);
      
      // Notify the original user
      await this.notificationsService.sendNotification(
        delegation.fromUserId,
        {
          type: 'delegation_rejected',
          title: 'Delegation Rejected',
          body: `${delegation.toUserId} has rejected your email delegation: "${delegation.email.subject}"`,
          data: {
            delegationId,
            emailId: delegation.emailId,
            subject: delegation.email.subject,
            reason,
          },
        }
      );
      
      return delegation;
    } catch (error) {
      this.logger.error(`Failed to reject delegation: ${error.message}`);
      throw error;
    }
  }
}
```

### 3. Smart Response Suggestions

**Files to Create:**
- `src/email/suggestions/response-suggestion.service.ts`
- `src/email/suggestions/models/suggestion-type.enum.ts`
- `src/email/suggestions/models/suggestion.model.ts`

**Response Suggestion Service Implementation:**

```typescript
// src/email/suggestions/response-suggestion.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../langgraph/llm/llm.service';
import { Email } from '../models/email.model';
import { SuggestionType } from './models/suggestion-type.enum';
import { Suggestion } from './models/suggestion.model';

@Injectable()
export class ResponseSuggestionService {
  private readonly logger = new Logger(ResponseSuggestionService.name);

  constructor(
    private llmService: LlmService,
  ) {}

  async generateSuggestions(email: Email): Promise<Suggestion[]> {
    try {
      const model = this.llmService.getChatModel({
        temperature: 0.4,
        model: 'gpt-4o',
      });
      
      const prompt = `
      Analyze this email and generate 3-5 appropriate response suggestions:
      
      From: ${email.from.name} <${email.from.address}>
      Subject: ${email.subject}
      
      ${email.body}
      
      For each suggestion, provide:
      1. Type: One of [QUICK_REPLY, SCHEDULE_MEETING, REQUEST_INFO, DELEGATE, ACKNOWLEDGE]
      2. Text: The suggested response text (1-2 sentences max)
      3. Action: Any associated action (e.g., scheduling a meeting on a specific date)
      
      Return a JSON array with these suggestion objects.
      `;
      
      const response = await model.invoke([
        {
          role: 'system',
          content: 'You are an email assistant that provides concise, contextually appropriate response suggestions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);
      
      const content = response.content.toString();
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                        content.match(/```\n([\s\S]*?)\n```/) ||
                        content.match(/(\[[\s\S]*\])/);
      
      if (!jsonMatch) {
        throw new Error('Failed to parse suggestions response');
      }
      
      const suggestions = JSON.parse(jsonMatch[1]);
      
      return suggestions.map(suggestion => ({
        id: `suggestion-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: suggestion.type,
        text: suggestion.text,
        action: suggestion.action,
        createdAt: new Date().toISOString(),
      }));
    } catch (error) {
      this.logger.error(`Failed to generate suggestions: ${error.message}`);
      return [];
    }
  }

  async expandSuggestion(suggestionId: string, suggestion: Suggestion, email: Email): Promise<string> {
    try {
      const model = this.llmService.getChatModel({
        temperature: 0.7,
        model: 'gpt-4o',
      });
      
      const prompt = `
      Expand this email response suggestion into a complete, professional email:
      
      Original Email:
      From: ${email.from.name} <${email.from.address}>
      Subject: ${email.subject}
      
      ${email.body}
      
      Suggestion: ${suggestion.text}
      Suggestion Type: ${suggestion.type}
      
      Write a complete email response that expands on this suggestion while maintaining a professional tone.
      Include appropriate greeting and sign-off.
      `;
      
      const response = await model.invoke([
        {
          role: 'system',
          content: 'You are an email assistant that expands brief suggestions into complete, professional email responses.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);
      
      return response.content.toString();
    } catch (error) {
      this.logger.error(`Failed to expand suggestion: ${error.message}`);
      throw error;
    }
  }
}
```

## Week 11-12: Advanced Email Management

### 1. Email Snoozing Functionality

**Files to Create:**
- `src/email/snooze/snooze.service.ts`
- `src/email/snooze/models/snooze-request.model.ts`
- `src/email/snooze/snooze-scheduler.service.ts`

**Snooze Service Implementation:**

```typescript
// src/email/snooze/snooze.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Email } from '../models/email.model';
import { EmailService } from '../email.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { SnoozeRequest } from './models/snooze-request.model';

@Injectable()
export class SnoozeService {
  private readonly logger = new Logger(SnoozeService.name);
  private readonly snoozeRequests = new Map<string, SnoozeRequest>();

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async snoozeEmail(
    userId: string,
    provider: string,
    emailId: string,
    snoozeUntil: Date | string,
    reason?: string,
  ): Promise<SnoozeRequest> {
    try {
      // Convert string to Date if necessary
      const snoozeDate = typeof snoozeUntil === 'string' ? new Date(snoozeUntil) : snoozeUntil;
      
      // Fetch the email
      const email = await this.emailService.getEmail(userId, provider, emailId);
      
      // Create snooze request
      const snoozeId = `snooze-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      const snoozeRequest: SnoozeRequest = {
        id: snoozeId,
        userId,
        provider,
        emailId,
        snoozeUntil: snoozeDate.toISOString(),
        reason,
        createdAt: new Date().toISOString(),
        email: {
          id: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date,
        },
      };
      
      // Store the snooze request
      this.snoozeRequests.set(snoozeId, snoozeRequest);
      
      // Schedule the reminder
      this.scheduleReminder(snoozeRequest);
      
      // Mark email as snoozed in metadata
      await this.emailService.updateEmailMetadata(userId, provider, emailId, {
        snoozed: true,
        snoozeId,
        snoozeUntil: snoozeDate.toISOString(),
        snoozeReason: reason,
      });
      
      return snoozeRequest;
    } catch (error) {
      this.logger.error(`Failed to snooze email: ${error.message}`);
      throw error;
    }
  }

  private scheduleReminder(snoozeRequest: SnoozeRequest): void {
    const { id, userId, provider, emailId, snoozeUntil } = snoozeRequest;
    const timeoutName = `snooze-${id}`;
    
    const now = new Date().getTime();
    const snoozeDate = new Date(snoozeUntil).getTime();
    const delay = snoozeDate - now;
    
    if (delay <= 0) {
      // Already past the snooze time, trigger reminder immediately
      this.handleSnoozeReminder(snoozeRequest);
      return;
    }
    
    // Schedule reminder
    const timeout = setTimeout(() => {
      this.handleSnoozeReminder(snoozeRequest);
    }, delay);
    
    this.schedulerRegistry.addTimeout(timeoutName, timeout);
  }

  private async handleSnoozeReminder(snoozeRequest: SnoozeRequest): Promise<void> {
    try {
      const { id, userId, provider, emailId } = snoozeRequest;
      
      // Fetch the latest version of the email
      const email = await this.emailService.getEmail(userId, provider, emailId);
      
      // Update email metadata to mark as unsnoozed
      await this.emailService.updateEmailMetadata(userId, provider, emailId, {
        snoozed: false,
        unsnoozedAt: new Date().toISOString(),
      });
      
      // Remove from snooze requests
      this.snoozeRequests.delete(id);
      
      // Notify user
      await this.notificationsService.sendNotification(
        userId,
        {
          type: 'email_unsnooze',
          title: 'Snoozed Email Reminder',
          body: `Your snoozed email "${email.subject}" is now back in your inbox.`,
          actionUrl: `/email/view/${provider}/${emailId}`,
          data: {
            snoozeId: id,
            emailId,
            subject: email.subject,
          },
        }
      );
    } catch (error) {
      this.logger.error(`Failed to handle snooze reminder: ${error.message}`);
    }
  }

  async cancelSnooze(snoozeId: string): Promise<boolean> {
    try {
      const snoozeRequest = this.snoozeRequests.get(snoozeId);
      if (!snoozeRequest) {
        throw new Error(`Snooze request not found: ${snoozeId}`);
      }
      
      const { userId, provider, emailId } = snoozeRequest;
      
      // Cancel scheduled timeout
      const timeoutName = `snooze-${snoozeId}`;
      if (this.schedulerRegistry.doesExist('timeout', timeoutName)) {
        this.schedulerRegistry.deleteTimeout(timeoutName);
      }
      
      // Update email metadata
      await this.emailService.updateEmailMetadata(userId, provider, emailId, {
        snoozed: false,
        unsnoozedAt: new Date().toISOString(),
        snoozeReason: 'Cancelled by user',
      });
      
      // Remove from snooze requests
      this.snoozeRequests.delete(snoozeId);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel snooze: ${error.message}`);
      return false;
    }
  }
}
```

### 2. Thread Summarization for Long Conversations

**Files to Create:**
- `src/email/summarization/thread-summarizer.service.ts`
- `src/email/summarization/models/summary-type.enum.ts`

**Thread Summarizer Implementation:**

```typescript
// src/email/summarization/thread-summarizer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../langgraph/llm/llm.service';
import { Thread } from '../models/thread.model';
import { SummaryType } from './models/summary-type.enum';
import { RAG_SERVICE } from '../../rag/constants/injection-tokens';
import { IRagService } from '../../rag/interfaces/rag-service.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class ThreadSummarizerService {
  private readonly logger = new Logger(ThreadSummarizerService.name);

  constructor(
    private llmService: LlmService,
    @Inject(RAG_SERVICE) private ragService: IRagService,
  ) {}

  async summarizeThread(
    thread: Thread,
    type: SummaryType = SummaryType.CONCISE,
  ): Promise<string> {
    try {
      const model = this.llmService.getChatModel({
        temperature: 0.3,
        model: 'gpt-4o',
      });
      
      // Format the thread for summarization
      const threadContent = this.formatThreadForSummarization(thread);
      
      // Generate the prompt based on summary type
      const prompt = this.generateSummaryPrompt(threadContent, type);
      
      // Get any relevant context from RAG
      const context = await this.getContextForThread(thread);
      
      const response = await model.invoke([
        {
          role: 'system',
          content: `You are an email thread summarization assistant. ${
            context ? 'Use the provided context to enhance your summary when relevant.' : ''
          }`,
        },
        {
          role: 'user',
          content: `${prompt}${context ? `\n\nRELEVANT CONTEXT:\n${context}` : ''}`,
        },
      ]);
      
      // Update thread metadata with summary
      thread.metadata = {
        ...thread.metadata,
        summary: {
          text: response.content.toString(),
          type,
          timestamp: new Date().toISOString(),
        },
      };
      
      return response.content.toString();
    } catch (error) {
      this.logger.error(`Failed to summarize thread: ${error.message}`);
      throw error;
    }
  }
  
  private formatThreadForSummarization(thread: Thread): string {
    // Format the thread as a conversation
    return thread.emails.map((email, index) => {
      const date = new Date(email.date).toLocaleString();
      return `[${date}] ${email.from.name} <${email.from.address}>:\n${email.body}`;
    }).join('\n\n---\n\n');
  }
  
  private generateSummaryPrompt(threadContent: string, type: SummaryType): string {
    const basePrompt = `
    Summarize the following email thread:
    
    ${threadContent}
    `;
    
    // Add specific instructions based on summary type
    switch (type) {
      case SummaryType.CONCISE:
        return `${basePrompt}\n\nProvide a concise summary (3-5 sentences) that captures the key points and any decisions or action items.`;
      
      case SummaryType.DETAILED:
        return `${basePrompt}\n\nProvide a detailed summary that covers all significant points in the conversation, any decisions made, and action items with owners if specified.`;
      
      case SummaryType.BULLET_POINTS:
        return `${basePrompt}\n\nProvide a bullet-point summary with the following sections:
        - Key Points
        - Decisions Made
        - Action Items (with owners and due dates if mentioned)
        - Open Questions`;
      
      case SummaryType.TIMELINE:
        return `${basePrompt}\n\nProvide a chronological timeline summary showing how the conversation evolved, highlighting key turning points and contributions.`;
      
      default:
        return basePrompt;
    }
  }
  
  private async getContextForThread(thread: Thread): Promise<string | null> {
    try {
      // Extract a query from the thread
      const query = `${thread.subject} ${
        thread.emails.slice(-1)[0].body.substring(0, 200)
      }`;
      
      // Get relevant documents from RAG
      const result = await this.ragService.retrieveDocuments(query, {
        topK: 3,
        minScore: 0.7,
      });
      
      if (!result || result.length === 0) {
        return null;
      }
      
      // Format the context
      return result.map(doc => {
        return `[${doc.metadata.source || 'Unknown source'}]\n${doc.content}`;
      }).join('\n\n');
    } catch (error) {
      this.logger.error(`Failed to get context for thread: ${error.message}`);
      return null;
    }
  }
}
```

### 3. Email Analytics and Insights

**Files to Create:**
- `src/email/analytics/email-analytics.service.ts`
- `src/email/analytics/models/analytics-period.enum.ts`
- `src/email/analytics/models/analytics-metric.enum.ts`
- `src/email/analytics/email-analytics.controller.ts`

**Email Analytics Service Implementation:**

```typescript
// src/email/analytics/email-analytics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Email } from '../models/email.model';
import { EmailService } from '../email.service';
import { AnalyticsPeriod } from './models/analytics-period.enum';
import { AnalyticsMetric } from './models/analytics-metric.enum';

interface VolumeMetrics {
  total: number;
  received: number;
  sent: number;
  percentChange?: number;
}

interface ResponseMetrics {
  averageResponseTime: number; // in minutes
  responseRate: number; // percentage
  responsesWithin24Hours: number;
  percentChange?: number;
}

interface PriorityMetrics {
  urgent: number;
  important: number;
  normal: number;
  low: number;
  unclassified: number;
}

@Injectable()
export class EmailAnalyticsService {
  private readonly logger = new Logger(EmailAnalyticsService.name);

  constructor(
    private emailService: EmailService,
  ) {}

  async getEmailAnalytics(
    userId: string,
    provider: string,
    period: AnalyticsPeriod = AnalyticsPeriod.WEEK,
    metrics: AnalyticsMetric[] = [
      AnalyticsMetric.VOLUME,
      AnalyticsMetric.RESPONSE_TIME,
      AnalyticsMetric.PRIORITY,
    ],
  ): Promise<any> {
    try {
      // Calculate date range for the requested period
      const { startDate, endDate, previousStartDate, previousEndDate } = this.calculateDateRange(period);
      
      // Fetch emails for the current period
      const emails = await this.emailService.getEmails(userId, provider, {
        startDate,
        endDate,
        includeMetadata: true,
        limit: 1000, // High limit to get comprehensive data
      });
      
      // Initialize results object
      const results: any = {
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };
      
      // Calculate requested metrics
      for (const metric of metrics) {
        switch (metric) {
          case AnalyticsMetric.VOLUME:
            results.volume = this.calculateVolumeMetrics(emails);
            
            // Get previous period data for comparison
            if (previousStartDate && previousEndDate) {
              const previousEmails = await this.emailService.getEmails(userId, provider, {
                startDate: previousStartDate,
                endDate: previousEndDate,
                includeMetadata: true,
                limit: 1000,
              });
              
              const previousVolume = this.calculateVolumeMetrics(previousEmails);
              
              // Calculate percent change
              if (previousVolume.total > 0) {
                const percentChange = ((results.volume.total - previousVolume.total) / previousVolume.total) * 100;
                results.volume.percentChange = Math.round(percentChange * 10) / 10; // Round to 1 decimal place
              }
            }
            break;
          
          case AnalyticsMetric.RESPONSE_TIME:
            results.responseMetrics = this.calculateResponseMetrics(emails);
            break;
          
          case AnalyticsMetric.PRIORITY:
            results.priority = this.calculatePriorityMetrics(emails);
            break;
            
          case AnalyticsMetric.CATEGORIES:
            results.categories = this.calculateCategoryMetrics(emails);
            break;
            
          case AnalyticsMetric.TOP_CONTACTS:
            results.topContacts = this.calculateTopContactsMetrics(emails);
            break;
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Failed to get email analytics: ${error.message}`);
      throw error;
    }
  }
  
  private calculateDateRange(period: AnalyticsPeriod): {
    startDate: Date;
    endDate: Date;
    previousStartDate?: Date;
    previousEndDate?: Date;
  } {
    const endDate = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;
    
    switch (period) {
      case AnalyticsPeriod.DAY:
        startDate = new Date(endDate);
        startDate.setHours(0, 0, 0, 0);
        
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
        previousStartDate = new Date(previousEndDate);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
        previousStartDate.setHours(0, 0, 0, 0);
        break;
        
      case AnalyticsPeriod.WEEK:
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 7);
        
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
        previousStartDate = new Date(previousEndDate);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        break;
        
      case AnalyticsPeriod.MONTH:
        startDate = new Date(endDate);
        startDate.setMonth(endDate.getMonth() - 1);
        
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
        previousStartDate = new Date(previousEndDate);
        previousStartDate.setMonth(previousStartDate.getMonth() - 1);
        break;
        
      case AnalyticsPeriod.QUARTER:
        startDate = new Date(endDate);
        startDate.setMonth(endDate.getMonth() - 3);
        
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
        previousStartDate = new Date(previousEndDate);
        previousStartDate.setMonth(previousStartDate.getMonth() - 3);
        break;
        
      default:
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 7);
        break;
    }
    
    return { startDate, endDate, previousStartDate, previousEndDate };
  }
  
  private calculateVolumeMetrics(emails: Email[]): VolumeMetrics {
    const received = emails.filter(email => !email.metadata?.sent).length;
    const sent = emails.filter(email => email.metadata?.sent).length;
    
    return {
      total: emails.length,
      received,
      sent,
    };
  }
  
  private calculateResponseMetrics(emails: Email[]): ResponseMetrics {
    // Group emails by thread
    const threadMap = new Map<string, Email[]>();
    
    emails.forEach(email => {
      const threadId = email.threadId || email.id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId).push(email);
    });
    
    // Calculate response times for each thread
    let totalResponseTime = 0;
    let responseCount = 0;
    let responsesWithin24Hours = 0;
    
    for (const [_, threadEmails] of threadMap.entries()) {
      // Sort emails by date
      const sortedEmails = threadEmails.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      // Skip if less than 2 emails (no response)
      if (sortedEmails.length < 2) {
        continue;
      }
      
      // Calculate response time for each email (except the first one)
      for (let i = 1; i < sortedEmails.length; i++) {
        const previousEmail = sortedEmails[i - 1];
        const currentEmail = sortedEmails[i];
        
        // Skip if same sender (not a response)
        if (previousEmail.from.address === currentEmail.from.address) {
          continue;
        }
        
        // Calculate response time in minutes
        const previousTime = new Date(previousEmail.date).getTime();
        const currentTime = new Date(currentEmail.date).getTime();
        const responseTimeMinutes = (currentTime - previousTime) / (1000 * 60);
        
        totalResponseTime += responseTimeMinutes;
        responseCount++;
        
        if (responseTimeMinutes <= 24 * 60) { // 24 hours in minutes
          responsesWithin24Hours++;
        }
      }
    }
    
    // Calculate averages
    const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
    const responseRate = threadMap.size > 0 ? responseCount / threadMap.size : 0;
    
    return {
      averageResponseTime,
      responseRate,
      responsesWithin24Hours,
    };
  }
  
  private calculatePriorityMetrics(emails: Email[]): PriorityMetrics {
    const urgent = emails.filter(email => 
      email.metadata?.classification?.priority === 'urgent' || 
      (email.metadata?.priorityScore?.score || 0) >= 80
    ).length;
    
    const important = emails.filter(email => 
      email.metadata?.classification?.priority === 'important' || 
      (email.metadata?.priorityScore?.score || 0) >= 60 && (email.metadata?.priorityScore?.score || 0) < 80
    ).length;
    
    const normal = emails.filter(email => 
      email.metadata?.classification?.priority === 'normal' || 
      (email.metadata?.priorityScore?.score || 0) >= 30 && (email.metadata?.priorityScore?.score || 0) < 60
    ).length;
    
    const low = emails.filter(email => 
      email.metadata?.classification?.priority === 'low' || 
      (email.metadata?.priorityScore?.score || 0) < 30 && email.metadata?.priorityScore?.score !== undefined
    ).length;
    
    const unclassified = emails.filter(email => 
      email.metadata?.classification?.priority === undefined && 
      email.metadata?.priorityScore?.score === undefined
    ).length;
    
    return {
      urgent,
      important,
      normal,
      low,
      unclassified,
    };
  }
  
  private calculateCategoryMetrics(emails: Email[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    emails.forEach(email => {
      const category = email.metadata?.classification?.category || 'uncategorized';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
  }
  
  private calculateTopContactsMetrics(emails: Email[]): Array<{
    email: string;
    name: string;
    count: number;
    direction: 'incoming' | 'outgoing' | 'both';
  }> {
    const contactMap = new Map<string, {
      name: string;
      incoming: number;
      outgoing: number;
    }>();
    
    // Count emails by contact
    emails.forEach(email => {
      if (email.metadata?.sent) {
        // Outgoing email
        email.to.forEach(to => {
          if (!contactMap.has(to.address)) {
            contactMap.set(to.address, { name: to.name, incoming: 0, outgoing: 0 });
          }
          
          const contact = contactMap.get(to.address);
          contact.outgoing++;
          contactMap.set(to.address, contact);
        });
      } else {
        // Incoming email
        const from = email.from;
        if (!contactMap.has(from.address)) {
          contactMap.set(from.address, { name: from.name, incoming: 0, outgoing: 0 });
        }
        
        const contact = contactMap.get(from.address);
        contact.incoming++;
        contactMap.set(from.address, contact);
      }
    });
    
    // Convert to array and sort by total count
    const topContacts = Array.from(contactMap.entries())
      .map(([email, data]) => ({
        email,
        name: data.name,
        count: data.incoming + data.outgoing,
        direction: data.incoming > 0 && data.outgoing > 0 
          ? 'both' 
          : (data.outgoing > 0 ? 'outgoing' : 'incoming'),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 contacts
    
    return topContacts;
  }
}
```

### 4. Email Follow-up Reminders

**Files to Create:**
- `src/email/followup/followup.service.ts`
- `src/email/followup/models/followup-request.model.ts`
- `src/email/followup/followup-detector.service.ts`

**Followup Service Implementation:**

```typescript
// src/email/followup/followup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { LlmService } from '../../langgraph/llm/llm.service';
import { Email } from '../models/email.model';
import { EmailService } from '../email.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { FollowupRequest } from './models/followup-request.model';

@Injectable()
export class FollowupService {
  private readonly logger = new Logger(FollowupService.name);
  private readonly followupRequests = new Map<string, FollowupRequest>();

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private llmService: LlmService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async createFollowupReminder(
    userId: string,
    provider: string,
    emailId: string,
    reminderDate: Date | string,
    notes?: string,
  ): Promise<FollowupRequest> {
    try {
      // Convert string to Date if necessary
      const followupDate = typeof reminderDate === 'string' ? new Date(reminderDate) : reminderDate;
      
      // Fetch the email
      const email = await this.emailService.getEmail(userId, provider, emailId);
      
      // Create followup request
      const followupId = `followup-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      const followupRequest: FollowupRequest = {
        id: followupId,
        userId,
        provider,
        emailId,
        followupDate: followupDate.toISOString(),
        notes,
        createdAt: new Date().toISOString(),
        status: 'pending',
        email: {
          id: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date,
        },
      };
      
      // Store the followup request
      this.followupRequests.set(followupId, followupRequest);
      
      // Schedule the reminder
      this.scheduleFollowup(followupRequest);
      
      // Mark email with followup metadata
      await this.emailService.updateEmailMetadata(userId, provider, emailId, {
        followup: {
          id: followupId,
          date: followupDate.toISOString(),
          notes,
          status: 'pending',
        },
      });
      
      return followupRequest;
    } catch (error) {
      this.logger.error(`Failed to create followup reminder: ${error.message}`);
      throw error;
    }
  }

  private scheduleFollowup(followupRequest: FollowupRequest): void {
    const { id, userId, followupDate } = followupRequest;
    const timeoutName = `followup-${id}`;
    
    const now = new Date().getTime();
    const followupTime = new Date(followupDate).getTime();
    const delay = followupTime - now;
    
    if (delay <= 0) {
      // Already past the followup time, trigger reminder immediately
      this.handleFollowupReminder(followupRequest);
      return;
    }
    
    // Schedule reminder
    const timeout = setTimeout(() => {
      this.handleFollowupReminder(followupRequest);
    }, delay);
    
    this.schedulerRegistry.addTimeout(timeoutName, timeout);
  }

  private async handleFollowupReminder(followupRequest: FollowupRequest): Promise<void> {
    try {
      const { id, userId, provider, emailId, notes } = followupRequest;
      
      // Fetch the latest version of the email
      const email = await this.emailService.getEmail(userId, provider, emailId);
      
      // Generate followup suggestion if needed
      let followupText = notes;
      if (!followupText) {
        followupText = await this.generateFollowupSuggestion(email);
      }
      
      // Update followup status
      followupRequest.status = 'triggered';
      followupRequest.triggeredAt = new Date().toISOString();
      this.followupRequests.set(id, followupRequest);
      
      // Update email metadata
      await this.emailService.updateEmailMetadata(userId, provider, emailId, {
        followup: {
          id,
          status: 'triggered',
          triggeredAt: new Date().toISOString(),
        },
      });
      
      // Notify user
      await this.notificationsService.sendNotification(
        userId,
        {
          type: 'followup_reminder',
          title: 'Email Follow-up Reminder',
          body: `Follow up required: "${email.subject}"`,
          actionUrl: `/email/view/${provider}/${emailId}`,
          data: {
            followupId: id,
            emailId,
            subject: email.subject,
            suggestion: followupText,
          },
        }
      );
    } catch (error) {
      this.logger.error(`Failed to handle followup reminder: ${error.message}`);
    }
  }

  private async generateFollowupSuggestion(email: Email): Promise<string> {
    try {
      const model = this.llmService.getChatModel({
        temperature: 0.7,
        model: 'gpt-4o',
      });
      
      const prompt = `
      Generate a brief follow-up message for this email:
      
      Subject: ${email.subject}
      
      ${email.body.substring(0, 500)}${email.body.length > 500 ? '...' : ''}
      
      Create a polite, concise follow-up message (1-2 sentences) that I can use to check on the status.
      `;
      
      const response = await model.invoke([
        {
          role: 'system',
          content: 'You are an assistant that helps write brief, professional email follow-ups.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);
      
      return response.content.toString();
    } catch (error) {
      this.logger.error(`Failed to generate followup suggestion: ${error.message}`);
      return 'Just following up on this email. Any updates?';
    }
  }

  async completeFollowup(followupId: string, resolution: string): Promise<boolean> {
    try {
      const followupRequest = this.followupRequests.get(followupId);
      if (!followupRequest) {
        throw new Error(`Followup request not found: ${followupId}`);
      }
      
      const { userId, provider, emailId } = followupRequest;
      
      // Cancel scheduled timeout if it exists
      const timeoutName = `followup-${followupId}`;
      if (this.schedulerRegistry.doesExist('timeout', timeoutName)) {
        this.schedulerRegistry.deleteTimeout(timeoutName);
      }
      
      // Update followup status
      followupRequest.status = 'completed';
      followupRequest.completedAt = new Date().toISOString();
      followupRequest.resolution = resolution;
      this.followupRequests.set(followupId, followupRequest);
      
      // Update email metadata
      await this.emailService.updateEmailMetadata(userId, provider, emailId, {
        followup: {
          id: followupId,
          status: 'completed',
          completedAt: new Date().toISOString(),
          resolution,
        },
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to complete followup: ${error.message}`);
      return false;
    }
  }
}
```

## Integration with MCP and Zapier

### MCP Integration for Email Triage

**Files to Create:**
- `src/mcp/providers/email-triage-provider.ts`
- `src/mcp/models/email-triage-tool.model.ts`

**Email Triage MCP Provider Implementation:**

```typescript
// src/mcp/providers/email-triage-provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { TriageService } from '../../email/triage/triage.service';
import { ResponseGeneratorService } from '../../email/responses/response-generator.service';
import { ResponseSuggestionService } from '../../email/suggestions/response-suggestion.service';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Tool } from '../models/tool.model';

@Injectable()
export class EmailTriageProvider {
  private readonly logger = new Logger(EmailTriageProvider.name);

  constructor(
    private emailService: EmailService,
    private triageService: TriageService,
    private responseGenerator: ResponseGeneratorService,
    private suggestionService: ResponseSuggestionService,
  ) {}

  async getTriageTools(): Promise<Tool[]> {
    return [
      new Tool({
        id: 'triageInbox',
        name: 'Triage Email Inbox',
        description: 'Prioritize and categorize emails in a user\'s inbox',
        schema: {
          name: 'triageInbox',
          description: 'Prioritize and categorize emails in a user\'s inbox',
          parameters: {
            userId: { 
              name: 'userId',
              type: 'string', 
              required: true,
              description: 'The user ID whose inbox should be triaged'
            },
            provider: { 
              name: 'provider',
              type: 'string', 
              required: true,
              description: 'The email provider (e.g., "gmail", "outlook")'
            },
            options: { 
              name: 'options',
              type: 'object', 
              required: false,
              description: 'Optional configuration for the triage process'
            },
          },
        },
        handler: this.triageInbox.bind(this),
      }),
      new Tool({
        id: 'generateResponse',
        name: 'Generate Email Response',
        description: 'Generate a response to an email',
        schema: {
          name: 'generateResponse',
          description: 'Generate a response to an email',
          parameters: {
            userId: { 
              name: 'userId',
              type: 'string', 
              required: true,
              description: 'The user ID who will send the response' 
            },
            provider: { 
              name: 'provider',
              type: 'string', 
              required: true,
              description: 'The email provider (e.g., "gmail", "outlook")' 
            },
            emailId: { 
              name: 'emailId',
              type: 'string', 
              required: true,
              description: 'The ID of the email to respond to' 
            },
            responseType: { 
              name: 'responseType',
              type: 'string', 
              required: false,
              description: 'The type of response to generate' 
            },
          },
        },
        handler: this.generateEmailResponse.bind(this),
      }),
      new Tool({
        id: 'getSuggestions',
        name: 'Get Response Suggestions',
        description: 'Get quick response suggestions for an email',
        schema: {
          name: 'getSuggestions',
          description: 'Get quick response suggestions for an email',
          parameters: {
            userId: { 
              name: 'userId',
              type: 'string', 
              required: true,
              description: 'The user ID requesting suggestions'
            },
            provider: { 
              name: 'provider',
              type: 'string', 
              required: true,
              description: 'The email provider (e.g., "gmail", "outlook")'
            },
            emailId: { 
              name: 'emailId',
              type: 'string', 
              required: true,
              description: 'The ID of the email to get suggestions for'
            },
          },
        },
        handler: this.getResponseSuggestions.bind(this),
      }),
    ];
  }

  async triageInbox(params: any): Promise<any> {
    try {
      const { userId, provider, options } = params;
      const result = await this.triageService.triageUserInbox(userId, provider, options);
      return result;
    } catch (error) {
      this.logger.error(`Failed to triage inbox: ${error.message}`);
      throw error;
    }
  }

  async generateEmailResponse(params: any): Promise<any> {
    try {
      const { userId, provider, emailId, responseType } = params;
      
      // Fetch the email
      const email = await this.emailService.getEmail(userId, provider, emailId);
      
      // Fetch thread if available
      let thread = null;
      if (email.threadId) {
        thread = await this.emailService.getThread(userId, provider, email.threadId);
      }
      
      // Generate response
      const response = await this.responseGenerator.generateResponse(
        email,
        thread,
        responseType,
      );
      
      return { response };
    } catch (error) {
      this.logger.error(`Failed to generate email response: ${error.message}`);
      throw error;
    }
  }

  async getResponseSuggestions(params: any): Promise<any> {
    try {
      const { userId, provider, emailId } = params;
      
      // Fetch the email
      const email = await this.emailService.getEmail(userId, provider, emailId);
      
      // Generate suggestions
      const suggestions = await this.suggestionService.generateSuggestions(email);
      
      return { suggestions };
    } catch (error) {
      this.logger.error(`Failed to get response suggestions: ${error.message}`);
      throw error;
    }
  }
}
```

### Zapier Integration for Email Triage

**Files to Create:**
- `src/zapier/email-triage-webhook.controller.ts`
- `src/zapier/dtos/email-triage.dto.ts`
- `src/email/snooze/snooze.service.ts`
- `src/email/delegation/delegation.service.ts`
- `src/email/followup/followup.service.ts`

**Email Triage Zapier Controller Implementation:**

```typescript
// src/zapier/email-triage-webhook.controller.ts
import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Query, 
  Headers, 
  UseGuards,
  UnauthorizedException 
} from '@nestjs/common';
import { ZapierService } from './zapier.service';
import { ZapierApiKeyGuard } from './guards/zapier-api-key.guard';
import { EmailClassifierService } from '../email/classification/email-classifier.service';
import { SnoozeService } from '../email/snooze/snooze.service';
import { DelegationService } from '../email/delegation/delegation.service';
import { FollowupService } from '../email/followup/followup.service';
import { SnoozeEmailDto, DelegateEmailDto, CreateFollowupDto } from './dtos/email-triage.dto';

@Controller('api/zapier')
@UseGuards(ZapierApiKeyGuard)
export class EmailTriageWebhookController {
  constructor(
    private zapierService: ZapierService,
    private emailClassifierService: EmailClassifierService,
    private snoozeService: SnoozeService,
    private delegationService: DelegationService,
    private followupService: FollowupService,
  ) {}

  @Get('triggers/classified-emails')
  async getClassifiedEmails(
    @Headers('x-user-id') userId: string,
    @Query('provider') provider: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('since') since?: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    
    // Get emails
    const emails = await this.zapierService.getRecentEmails(userId, provider, 'INBOX', since);
    
    // Filter classified emails
    return emails.filter(email => {
      // Only include emails that have been classified
      if (!email.metadata?.classification) return false;
      
      // Filter by priority if specified
      if (priority && email.metadata.classification.priority !== priority) return false;
      
      // Filter by category if specified
      if (category && email.metadata.classification.category !== category) return false;
      
      return true;
    });
  }

  @Post('actions/snooze')
  async snoozeEmail(
    @Headers('x-user-id') userId: string,
    @Body() body: SnoozeEmailDto
  ) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    
    // Snooze the email
    const { emailId, provider, snoozeUntil, reason } = body;
    const snoozeRequest = await this.snoozeService.snoozeEmail(
      userId,
      provider,
      emailId,
      snoozeUntil,
      reason,
    );
    
    return snoozeRequest;
  }

  @Post('actions/delegate')
  async delegateEmail(
    @Headers('x-user-id') userId: string,
    @Body() body: DelegateEmailDto
  ) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    
    // Delegate the email
    const { emailId, provider, delegateTo, notes } = body;
    const delegationRequest = await this.delegationService.delegateEmail(
      userId,
      emailId,
      provider,
      delegateTo,
      notes,
    );
    
    return delegationRequest;
  }

  @Post('actions/followup')
  async createFollowup(
    @Headers('x-user-id') userId: string,
    @Body() body: CreateFollowupDto
  ) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    
    // Create the followup
    const { emailId, provider, reminderDate, notes } = body;
    const followupRequest = await this.followupService.createFollowupReminder(
      userId,
      provider,
      emailId,
      reminderDate,
      notes,
    );
    
    return followupRequest;
  }
}
```

**Email Triage DTOs:**

```typescript
// src/zapier/dtos/email-triage.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class SnoozeEmailDto {
  @IsString()
  @IsNotEmpty()
  emailId: string;

  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsDateString()
  @IsNotEmpty()
  snoozeUntil: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class DelegateEmailDto {
  @IsString()
  @IsNotEmpty()
  emailId: string;

  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsString()
  @IsNotEmpty()
  delegateTo: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateFollowupDto {
  @IsString()
  @IsNotEmpty()
  emailId: string;

  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsDateString()
  @IsNotEmpty()
  reminderDate: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
```

**Snooze Service Implementation:**

```typescript
// src/email/snooze/snooze.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email.service';

@Injectable()
export class SnoozeService {
  private readonly logger = new Logger(SnoozeService.name);
  private readonly snoozedEmails = new Map<string, any>();

  constructor(
    private emailService: EmailService,
  ) {}

  async snoozeEmail(
    userId: string, 
    provider: string, 
    emailId: string, 
    snoozeUntil: string,
    reason?: string,
  ): Promise<any> {
    try {
      // Get the email
      const email = await this.emailService.getEmail(userId, provider, emailId);
      
      if (!email) {
        throw new Error(`Email not found: ${emailId}`);
      }
      
      // Create snooze record
      const snoozeId = `snooze-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      const snoozeRecord = {
        id: snoozeId,
        emailId,
        userId,
        provider,
        snoozeUntil: new Date(snoozeUntil),
        reason,
        createdAt: new Date(),
        status: 'snoozed',
      };
      
      // Store snooze record
      this.snoozedEmails.set(snoozeId, snoozeRecord);
      
      // Update email metadata to mark as snoozed
      await this.emailService.updateEmailMetadata(userId, provider, emailId, {
        ...email.metadata,
        snoozed: true,
        snoozeId,
        snoozeUntil,
      });
      
      return snoozeRecord;
    } catch (error) {
      this.logger.error(`Failed to snooze email: ${error.message}`);
      throw error;
    }
  }

  async getSnoozedEmails(userId: string): Promise<any[]> {
    const userSnoozed: any[] = [];
    
    for (const [_, record] of this.snoozedEmails.entries()) {
      if (record.userId === userId && record.status === 'snoozed') {
        userSnoozed.push(record);
      }
    }
    
    return userSnoozed;
  }

  async unsnoozeMail(userId: string, snoozeId: string): Promise<any> {
    try {
      const record = this.snoozedEmails.get(snoozeId);
      
      if (!record || record.userId !== userId) {
        throw new Error(`Snooze record not found: ${snoozeId}`);
      }
      
      // Update status
      record.status = 'unsnooze';
      record.updatedAt = new Date();
      
      // Store updated record
      this.snoozedEmails.set(snoozeId, record);
      
      // Update email metadata
      await this.emailService.updateEmailMetadata(
        userId, 
        record.provider, 
        record.emailId, 
        {
          snoozed: false,
        }
      );
      
      return record;
    } catch (error) {
      this.logger.error(`Failed to unsnooze email: ${error.message}`);
      throw error;
    }
  }
}
```

**Delegation Service Implementation:**

```typescript
// src/email/delegation/delegation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);
  private readonly delegations = new Map<string, any>();

  constructor(
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async delegateEmail(
    userId: string,
    emailId: string,
    provider: string,
    delegateTo: string,
    notes?: string,
  ): Promise<any> {
    try {
      // Get the email
      const email = await this.emailService.getEmail(userId, provider, emailId);
      
      if (!email) {
        throw new Error(`Email not found: ${emailId}`);
      }
      
      // Create delegation record
      const delegationId = `delegation-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      const delegation = {
        id: delegationId,
        emailId,
        userId,
        provider,
        delegatedTo: delegateTo,
        notes,
        createdAt: new Date(),
        status: 'pending',
      };
      
      // Store delegation record
      this.delegations.set(delegationId, delegation);
      
      // Update email metadata to mark as delegated
      await this.emailService.updateEmailMetadata(userId, provider, emailId, {
        ...email.metadata,
        delegated: true,
        delegationId,
        delegatedTo,
      });
      
      // Notify the delegated user (in a real implementation, this would send an email)
      // For now, just log it
      this.logger.log(`Email ${emailId} delegated to ${delegateTo}`);
      
      return delegation;
    } catch (error) {
      this.logger.error(`Failed to delegate email: ${error.message}`);
      throw error;
    }
  }

  async getDelegations(userId: string): Promise<any[]> {
    const userDelegations: any[] = [];
    
    for (const [_, delegation] of this.delegations.entries()) {
      if (delegation.userId === userId) {
        userDelegations.push(delegation);
      }
    }
    
    return userDelegations;
  }

  async acceptDelegation(delegationId: string): Promise<any> {
    try {
      const delegation = this.delegations.get(delegationId);
      
      if (!delegation) {
        throw new Error(`Delegation not found: ${delegationId}`);
      }
      
      // Update status
      delegation.status = 'accepted';
      delegation.updatedAt = new Date();
      
      // Store updated delegation
      this.delegations.set(delegationId, delegation);
      
      // Notify the original user
      await this.notificationsService.sendNotification(
        delegation.userId,
        {
          type: 'delegation_accepted',
          title: 'Delegation Accepted',
          body: `Your delegated email has been accepted by ${delegation.delegatedTo}`,
          data: {
            delegationId,
            emailId: delegation.emailId,
          },
        }
      );
      
      return delegation;
    } catch (error) {
      this.logger.error(`Failed to accept delegation: ${error.message}`);
      throw error;
    }
  }
}
```

**Followup Service Implementation:**

```typescript
// src/email/followup/followup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class FollowupService {
  private readonly logger = new Logger(FollowupService.name);
  private readonly followups = new Map<string, any>();

  constructor(
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async createFollowupReminder(
    userId: string,
    provider: string,
    emailId: string,
    reminderDate: string,
    notes?: string,
  ): Promise<any> {
    try {
      // Get the email
      const email = await this.emailService.getEmail(userId, provider, emailId);
      
      if (!email) {
        throw new Error(`Email not found: ${emailId}`);
      }
      
      // Create followup record
      const followupId = `followup-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      const followup = {
        id: followupId,
        emailId,
        userId,
        provider,
        reminderDate: new Date(reminderDate),
        notes,
        createdAt: new Date(),
        status: 'pending',
      };
      
      // Store followup record
      this.followups.set(followupId, followup);
      
      // Update email metadata to mark as having followup
      await this.emailService.updateEmailMetadata(userId, provider, emailId, {
        ...email.metadata,
        hasFollowup: true,
        followupId,
        reminderDate,
      });
      
      return followup;
    } catch (error) {
      this.logger.error(`Failed to create followup: ${error.message}`);
      throw error;
    }
  }

  async getFollowups(userId: string): Promise<any[]> {
    const userFollowups: any[] = [];
    
    for (const [_, followup] of this.followups.entries()) {
      if (followup.userId === userId) {
        userFollowups.push(followup);
      }
    }
    
    return userFollowups;
  }

  async completeFollowup(userId: string, followupId: string): Promise<any> {
    try {
      const followup = this.followups.get(followupId);
      
      if (!followup || followup.userId !== userId) {
        throw new Error(`Followup not found: ${followupId}`);
      }
      
      // Update status
      followup.status = 'completed';
      followup.completedAt = new Date();
      
      // Store updated followup
      this.followups.set(followupId, followup);
      
      return followup;
    } catch (error) {
      this.logger.error(`Failed to complete followup: ${error.message}`);
      throw error;
    }
  }

  // This would be called by a scheduler in a real implementation
  async checkDueFollowups(): Promise<void> {
    const now = new Date();
    
    for (const [followupId, followup] of this.followups.entries()) {
      if (followup.status === 'pending' && followup.reminderDate <= now) {
        // Send notification to user
        await this.notificationsService.sendNotification(
          followup.userId,
          {
            type: 'followup_reminder',
            title: 'Followup Reminder',
            body: `You have a followup reminder for an email: ${followup.notes || 'No notes'}`,
            data: {
              followupId,
              emailId: followup.emailId,
            },
          }
        );
        
        // Update status to reminded
        followup.status = 'reminded';
        followup.remindedAt = now;
        
        // Store updated followup
        this.followups.set(followupId, followup);
      }
    }
  }
}
```

**Update Zapier Module:**

To include the email triage features in the Zapier integration, update the Zapier module:

```typescript
// src/zapier/zapier.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ZapierService } from './zapier.service';
import { ZapierWebhookController } from './zapier-webhook.controller';
import { ZapierAuthController } from './zapier-auth.controller';
import { EmailTriageWebhookController } from './email-triage-webhook.controller';
import { EmailModule } from '../email/email.module';
import { TasksModule } from '../tasks/tasks.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailClassifierModule } from '../email/classification/email-classifier.module';
import { SnoozeModule } from '../email/snooze/snooze.module';
import { DelegationModule } from '../email/delegation/delegation.module';
import { FollowupModule } from '../email/followup/followup.module';

@Module({
  imports: [
    ConfigModule,
    EmailModule,
    TasksModule,
    NotificationsModule,
    EmailClassifierModule,
    SnoozeModule,
    DelegationModule,
    FollowupModule,
  ],
  controllers: [
    ZapierWebhookController,
    ZapierAuthController,
    EmailTriageWebhookController,
  ],
  providers: [
    ZapierService,
  ],
  exports: [
    ZapierService,
  ],
})
export class ZapierModule {}
```

**Setting Up Zapier Integration in the Web Interface:**

After implementing the REST API endpoints, you can create the integration in the Zapier Web Builder:

1. Go to [Zapier Developer Platform](https://developer.zapier.com/)
2. Create a new integration
3. Set up authentication (use the OAuth2 configuration)
4. Add the following triggers and actions:

**Triggers:**
- New Email (using `/api/zapier/triggers/emails` endpoint)
- New Classified Email (using `/api/zapier/triggers/classified-emails` endpoint)

**Actions:**
- Create Task (using `/api/zapier/actions/tasks` endpoint)
- Snooze Email (using `/api/zapier/actions/snooze` endpoint)
- Delegate Email (using `/api/zapier/actions/delegate` endpoint)
- Create Followup (using `/api/zapier/actions/followup` endpoint)

**Searches:**
- Find Task (using `/api/zapier/searches/tasks` endpoint)

**Testing and Deployment:**

After setting up the integration:

1. Test each endpoint with sample data
2. Invite team members to test the integration
3. Make it public (optional) by submitting for review

This implementation approach allows for easier maintenance since all code resides within your NestJS application, without the need to maintain a separate Zapier CLI project.

## Conclusion

This implementation guide covers the development plan for the second phase of FollowThrough AI:

 **Email Triage System**
   - Email classification and prioritization
   - Response generation and suggestions
   - Email management features (snoozing, delegation, threading)
   - Thread summarization
   - Email analytics and insights
   - Follow-up reminders

The implementation leverages our existing LangGraph architecture and combines it with MCP and Zapier integrations to create a powerful email management and triage system. The services and components described here form a comprehensive solution that can be integrated into our current system.

Next steps would be to implement the UI components, create comprehensive testing, and prepare the system for production deployment.

**Email Classifier Module Implementation:**

```typescript
// src/email/classification/email-classifier.module.ts
import { Module } from '@nestjs/common';
import { EmailClassifierService } from './email-classifier.service';
import { LangGraphModule } from '../../langgraph/langgraph.module';

@Module({
  imports: [
    LangGraphModule,
  ],
  providers: [EmailClassifierService],
  exports: [EmailClassifierService],
})
export class EmailClassifierModule {}
```

**Prioritization Module Implementation:**

```typescript
// src/email/prioritization/prioritization.module.ts
import { Module } from '@nestjs/common';
import { PriorityScorerService } from './priority-scorer.service';
import { SenderRule } from './scoring-rules/sender-rule';
import { ContentRule } from './scoring-rules/content-rule';
import { UrgencyRule } from './scoring-rules/urgency-rule';

@Module({
  providers: [
    PriorityScorerService,
    SenderRule,
    ContentRule,
    UrgencyRule,
  ],
  exports: [PriorityScorerService],
})
export class PrioritizationModule {}
```

**Base Scoring Rule Implementation:**

```typescript
// src/email/prioritization/scoring-rules/base-scoring-rule.ts
import { Email } from '../../models/email.model';

export interface ScoringResult {
  score: number;
  reason?: string;
}

export abstract class BaseScoringRule {
  abstract apply(email: Email, userId: string): Promise<ScoringResult>;
  
  protected normalizeScore(score: number, min: number = 0, max: number = 100): number {
    return Math.min(Math.max(score, min), max);
  }
}
```

**Sender Rule Implementation:**

```typescript
// src/email/prioritization/scoring-rules/sender-rule.ts
import { Injectable, Logger } from '@nestjs/common';
import { BaseScoringRule, ScoringResult } from './base-scoring-rule';
import { Email } from '../../models/email.model';

interface SenderPriority {
  address: string;
  score: number;
  category?: string;
}

@Injectable()
export class SenderRule extends BaseScoringRule {
  private readonly logger = new Logger(SenderRule.name);
  private readonly userPriorities = new Map<string, SenderPriority[]>();

  constructor() {
    super();
    // In a real implementation, this would be loaded from a database
  }

  async apply(email: Email, userId: string): Promise<ScoringResult> {
    try {
      // Get the list of priority senders for this user
      const priorities = await this.getUserPriorities(userId);
      
      // Check if the sender is in the priority list
      const sender = email.from.address.toLowerCase();
      const priority = priorities.find(p => p.address.toLowerCase() === sender);
      
      if (priority) {
        return {
          score: priority.score,
          reason: `Email from priority sender (${priority.category || 'custom'})`,
        };
      }
      
      // Check for common corporate domains which might be important
      if (this.isFromCorporateDomain(sender)) {
        return {
          score: 60,
          reason: 'Email from corporate domain',
        };
      }
      
      // Check if it's from a domain that the user frequently communicates with
      if (await this.isFrequentContact(sender, userId)) {
        return {
          score: 50,
          reason: 'Email from frequent contact',
        };
      }
      
      // Default score for unknown senders
      return {
        score: 30,
        reason: 'Email from non-priority sender',
      };
    } catch (error) {
      this.logger.error(`Error applying sender rule: ${error.message}`);
      return { score: 0 };
    }
  }
  
  private async getUserPriorities(userId: string): Promise<SenderPriority[]> {
    // Check if priorities are already cached
    if (this.userPriorities.has(userId)) {
      return this.userPriorities.get(userId);
    }
    
    // In a real implementation, this would be loaded from a database
    // Here, we're just creating some sample data
    const priorities: SenderPriority[] = [
      { address: 'boss@company.com', score: 90, category: 'VIP' },
      { address: 'ceo@company.com', score: 95, category: 'VIP' },
      { address: 'client@bigcustomer.com', score: 85, category: 'Client' },
      { address: 'teammate@company.com', score: 75, category: 'Team' },
    ];
    
    // Cache the priorities for future use
    this.userPriorities.set(userId, priorities);
    
    return priorities;
  }
  
  private isFromCorporateDomain(sender: string): boolean {
    // Check if the sender is from a corporate domain
    const corporateDomains = [
      'company.com',
      'partner.com',
      'client.com',
      'vendor.com',
    ];
    
    return corporateDomains.some(domain => sender.endsWith(`@${domain}`));
  }
  
  private async isFrequentContact(sender: string, userId: string): Promise<boolean> {
    // In a real implementation, this would check communication history
    // For now, we'll just return false
    return false;
  }
}
```
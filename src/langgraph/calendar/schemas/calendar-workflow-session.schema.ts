import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CalendarWorkflowState, CalendarWorkflowStage, CalendarWorkflowStep } from '../interfaces/calendar-workflow-state.interface';

export type CalendarWorkflowSessionDocument = CalendarWorkflowSession & Document;

@Schema({ 
  timestamps: true,
  collection: 'calendar_workflow_sessions'
})
export class CalendarWorkflowSession implements CalendarWorkflowState {
  @Prop({ required: true, unique: true, index: true })
  sessionId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  eventId: string;

  // Event data
  @Prop({ type: Object, required: true })
  calendarEvent: any; // CalendarEvent object

  @Prop({ 
    type: String, 
    enum: ['scheduled', 'started', 'ended'],
    default: 'scheduled',
    index: true
  })
  meetingStatus: 'scheduled' | 'started' | 'ended';

  // Analysis results
  @Prop({ type: Object, default: null })
  preContext: any; // PreMeetingContext object

  @Prop({ type: Object, default: null })
  meetingBrief: any; // MeetingBrief object

  @Prop({ type: String, default: null })
  meetingTranscript: string | null;

  @Prop({ type: Object, default: null })
  meetingRecording: any; // MeetingRecording object

  @Prop({ type: Object, default: null })
  analysisResult: any; // MeetingAnalysisResult object

  @Prop({ type: Object, default: null })
  followUpPlan: any; // FollowUpPlan object

  // Workflow control
  @Prop({ 
    type: String, 
    enum: Object.values(CalendarWorkflowStage),
    default: CalendarWorkflowStage.INITIALIZED,
    index: true
  })
  stage: string;

  @Prop({ 
    type: String, 
    enum: Object.values(CalendarWorkflowStep),
    default: CalendarWorkflowStep.START,
    index: true
  })
  currentStep: string;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  progress: number;

  @Prop({ type: String, default: null })
  error: string | null;

  // Context and metadata
  @Prop({ type: Object, default: {} })
  context: Record<string, any>;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({
    type: {
      agentsUsed: { type: [String], default: [] },
      ragEnhanced: { type: Boolean, default: false },
      performanceMetrics: { type: Object, default: {} },
      startTime: { type: String, required: true },
      endTime: { type: String, default: null }
    },
    default: () => ({
      agentsUsed: [],
      ragEnhanced: false,
      performanceMetrics: {},
      startTime: new Date().toISOString(),
      endTime: null
    })
  })
  processingMetadata: {
    agentsUsed: string[];
    ragEnhanced: boolean;
    performanceMetrics: Record<string, number>;
    startTime: string;
    endTime?: string;
  };

  // Workflow-specific state
  @Prop({
    type: {
      delivered: { type: Boolean, default: false },
      deliveryMethods: { type: [String], default: [] },
      deliveryTime: { type: String, default: null },
      recipients: { type: [String], default: [] }
    },
    default: null
  })
  briefDeliveryStatus?: {
    delivered: boolean;
    deliveryMethods: string[];
    deliveryTime?: string;
    recipients: string[];
  };

  @Prop({
    type: {
      emailsGenerated: { type: Number, default: 0 },
      meetingsScheduled: { type: Number, default: 0 },
      tasksCreated: { type: Number, default: 0 },
      routingComplete: { type: Boolean, default: false }
    },
    default: null
  })
  followUpStatus?: {
    emailsGenerated: number;
    meetingsScheduled: number;
    tasksCreated: number;
    routingComplete: boolean;
  };

  @Prop({ 
    type: String, 
    enum: ['manual', 'assisted', 'automated'],
    default: 'assisted'
  })
  autonomyLevel?: "manual" | "assisted" | "automated";

  @Prop({ type: Boolean, default: false })
  approvalRequired?: boolean;

  @Prop({
    type: [{
      timestamp: { type: String, required: true },
      type: { 
        type: String, 
        enum: ['approval', 'modification', 'cancellation', 'feedback'],
        required: true 
      },
      details: { type: Object, default: {} },
      result: { 
        type: String, 
        enum: ['approved', 'rejected', 'modified'],
        required: true 
      }
    }],
    default: []
  })
  userInteractions?: Array<{
    timestamp: string;
    type: "approval" | "modification" | "cancellation" | "feedback";
    details: Record<string, any>;
    result: "approved" | "rejected" | "modified";
  }>;

  // Workflow tracking
  @Prop({ type: Date, default: Date.now, index: true })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Number, default: null })
  processingTimeMs: number | null;

  // Indexing for analytics and queries
  @Prop({ type: Date, default: null, index: true })
  scheduledMeetingTime: Date | null;

  @Prop({ type: Date, default: null, index: true })
  actualMeetingStartTime: Date | null;

  @Prop({ type: Date, default: null, index: true })
  actualMeetingEndTime: Date | null;

  @Prop({ type: [String], default: [], index: true })
  participantEmails: string[];

  @Prop({ type: String, default: null, index: true })
  meetingOrganizer: string | null;

  @Prop({ type: Boolean, default: false, index: true })
  isRecurring: boolean;

  @Prop({ type: String, default: null })
  recurringSeriesId: string | null;

  // Analytics fields
  @Prop({ type: Number, default: null })
  briefGenerationTimeMs: number | null;

  @Prop({ type: Number, default: null })
  analysisProcessingTimeMs: number | null;

  @Prop({ type: Number, default: null })
  followUpGenerationTimeMs: number | null;

  @Prop({ type: Boolean, default: false })
  hadErrors: boolean;

  @Prop({ type: [String], default: [] })
  errorStages: string[];

  @Prop({ type: Number, default: 0 })
  retryCount: number;

  @Prop({ type: Object, default: {} })
  ragMetrics: Record<string, any>;

  // Additional fields for enterprise features
  @Prop({ type: String, default: null })
  departmentId: string | null;

  @Prop({ type: String, default: null })
  projectId: string | null;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, default: 'active', enum: ['active', 'archived', 'deleted'] })
  status: 'active' | 'archived' | 'deleted';
}

export const CalendarWorkflowSessionSchema = SchemaFactory.createForClass(CalendarWorkflowSession);

// Indexes for performance
CalendarWorkflowSessionSchema.index({ userId: 1, createdAt: -1 });
CalendarWorkflowSessionSchema.index({ eventId: 1, userId: 1 });
CalendarWorkflowSessionSchema.index({ stage: 1, createdAt: -1 });
CalendarWorkflowSessionSchema.index({ meetingStatus: 1, scheduledMeetingTime: 1 });
CalendarWorkflowSessionSchema.index({ participantEmails: 1, createdAt: -1 });
CalendarWorkflowSessionSchema.index({ status: 1, updatedAt: -1 });

// Compound indexes for analytics
CalendarWorkflowSessionSchema.index({ 
  userId: 1, 
  stage: 1, 
  meetingStatus: 1, 
  createdAt: -1 
});

CalendarWorkflowSessionSchema.index({ 
  meetingOrganizer: 1, 
  completedAt: -1 
});

// TTL index for automatic cleanup of old sessions (optional)
CalendarWorkflowSessionSchema.index({ 
  createdAt: 1 
}, { 
  expireAfterSeconds: 60 * 60 * 24 * 365 // 1 year
});

// Middleware to update timestamps
CalendarWorkflowSessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set completion time and processing time when workflow completes
  if (this.stage === CalendarWorkflowStage.COMPLETED && !this.completedAt) {
    this.completedAt = new Date();
    if (this.processingMetadata?.startTime) {
      const startTime = new Date(this.processingMetadata.startTime);
      this.processingTimeMs = this.completedAt.getTime() - startTime.getTime();
    }
  }
  
  // Set meeting times from calendar event
  if (this.calendarEvent) {
    this.scheduledMeetingTime = new Date(this.calendarEvent.startTime);
    this.participantEmails = this.calendarEvent.attendees?.map((a: any) => a.email) || [];
    this.meetingOrganizer = this.calendarEvent.organizer?.email || null;
    this.isRecurring = this.calendarEvent.recurring || false;
    this.recurringSeriesId = this.calendarEvent.recurringEventId || null;
  }
  
  next();
});

// Methods for state transitions
CalendarWorkflowSessionSchema.methods.updateStage = function(
  newStage: CalendarWorkflowStage, 
  newStep?: CalendarWorkflowStep, 
  progress?: number
) {
  this.stage = newStage;
  if (newStep) this.currentStep = newStep;
  if (progress !== undefined) this.progress = progress;
  this.updatedAt = new Date();
};

CalendarWorkflowSessionSchema.methods.addUserInteraction = function(interaction: {
  type: "approval" | "modification" | "cancellation" | "feedback";
  details: Record<string, any>;
  result: "approved" | "rejected" | "modified";
}) {
  if (!this.userInteractions) this.userInteractions = [];
  this.userInteractions.push({
    timestamp: new Date().toISOString(),
    ...interaction
  });
  this.updatedAt = new Date();
};

CalendarWorkflowSessionSchema.methods.markError = function(error: string, stage?: string) {
  this.error = error;
  this.hadErrors = true;
  if (stage && !this.errorStages.includes(stage)) {
    this.errorStages.push(stage);
  }
  this.stage = CalendarWorkflowStage.ERROR;
  this.updatedAt = new Date();
};

CalendarWorkflowSessionSchema.methods.addAgentUsage = function(agentName: string) {
  if (!this.processingMetadata.agentsUsed.includes(agentName)) {
    this.processingMetadata.agentsUsed.push(agentName);
  }
  this.updatedAt = new Date();
};

CalendarWorkflowSessionSchema.methods.updatePerformanceMetric = function(metric: string, value: number) {
  this.processingMetadata.performanceMetrics[metric] = value;
  this.updatedAt = new Date();
};
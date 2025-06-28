import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { ApiProperty } from "@nestjs/swagger";

export type EmailTriageSessionDocument = EmailTriageSession & Document;

@Schema({ timestamps: true, suppressReservedKeysWarning: true })
export class EmailTriageSession {
  @Prop({ required: true })
  @ApiProperty({ description: "Unique session identifier" })
  sessionId: string;

  @Prop({ required: true })
  @ApiProperty({ description: "User ID who owns the email" })
  userId: string;

  @Prop({ required: true })
  @ApiProperty({ description: "Email ID from the email provider" })
  emailId: string;

  @Prop({
    required: true,
    enum: ["processing", "completed", "failed"],
    default: "processing",
  })
  @ApiProperty({
    description: "Current status of the triage",
    enum: ["processing", "completed", "failed"],
  })
  status: string;

  @Prop({ type: Number, default: 0 })
  @ApiProperty({
    description: "Progress percentage of the triage (0-100)",
    minimum: 0,
    maximum: 100,
  })
  progress?: number;

  @Prop({ type: Date, required: true })
  @ApiProperty({ description: "When the triage session was created" })
  startTime: Date;

  @Prop({ type: Date })
  @ApiProperty({ description: "When the triage session was completed or failed" })
  endTime?: Date;

  @Prop({ type: Object, required: true })
  @ApiProperty({ description: "Original email data and metadata" })
  emailData: {
    id: string;
    body: string;
    metadata: {
      subject?: string;
      from?: string;
      to?: string;
      timestamp?: string;
      headers?: any;
      userId?: string;
      messageId?: string;
      threadId?: string;
      labels?: string[];
    };
  };

  @Prop({ type: Object })
  @ApiProperty({ 
    description: "Email classification results",
    type: Object,
    example: {
      priority: "high",
      category: "bug_report",
      reasoning: "Email contains urgent bug report requiring immediate attention",
      confidence: 0.92
    }
  })
  classification?: {
    priority: "urgent" | "high" | "normal" | "low";
    category: "bug_report" | "feature_request" | "question" | "complaint" | "praise" | "other";
    reasoning: string;
    confidence: number;
  };

  @Prop({ type: Object })
  @ApiProperty({ 
    description: "Email summary analysis",
    type: Object,
    example: {
      problem: "Production server experiencing intermittent crashes",
      context: "Issue started after latest deployment affecting user sessions",
      ask: "Requesting immediate investigation and hotfix deployment",
      summary: "Critical production issue requiring urgent attention and resolution"
    }
  })
  summary?: {
    problem: string;
    context: string;
    ask: string;
    summary: string;
  };

  @Prop({ type: Object })
  @ApiProperty({ 
    description: "Generated reply draft",
    type: Object,
    example: {
      subject: "Re: Production Server Issues - Immediate Action Required",
      body: "Thank you for reporting this critical issue. I'm escalating this immediately to our engineering team...",
      tone: "professional",
      next_steps: ["Escalate to engineering team", "Monitor server status", "Prepare hotfix deployment"]
    }
  })
  replyDraft?: {
    subject: string;
    body: string;
    tone: "professional" | "friendly" | "urgent";
    next_steps: string[];
  };

  @Prop({ type: Array })
  @ApiProperty({ 
    description: "Retrieved context from RAG system",
    type: [Object],
    example: [{
      id: "context-123",
      content: "Similar issue resolved by restarting database connections",
      metadata: { source: "previous_tickets", relevance: 0.85 },
      score: 0.85,
      namespace: "email-patterns"
    }]
  })
  retrievedContext?: Array<{
    id: string;
    content: string;
    metadata?: any;
    score?: number;
    namespace?: string;
  }>;

  @Prop({ type: Object })
  @ApiProperty({ 
    description: "Processing metadata and performance metrics",
    type: Object,
    example: {
      startedAt: "2024-12-20T10:30:00.000Z",
      ragEnhanced: true,
      agentsUsed: ["classification", "summarization", "reply-draft"],
      performanceMetrics: {
        contextRetrievalMs: 150,
        classificationMs: 800,
        summarizationMs: 1200,
        replyDraftMs: 900,
        totalProcessingMs: 3500
      }
    }
  })
  processingMetadata?: {
    startedAt?: string;
    ragEnhanced?: boolean;
    agentsUsed?: string[];
    performanceMetrics?: {
      contextRetrievalMs?: number;
      classificationMs?: number;
      summarizationMs?: number;
      replyDraftMs?: number;
      totalProcessingMs?: number;
    };
  };

  @Prop({ type: Object })
  @ApiProperty({ 
    description: "Context retrieval results and statistics",
    type: Object,
    example: {
      totalQueries: 3,
      totalDocuments: 15,
      namespaces: ["email-patterns", "user-history"],
      retrievalDuration: 150,
      retrievedAt: "2024-12-20T10:30:01.000Z"
    }
  })
  contextRetrievalResults?: {
    totalQueries: number;
    totalDocuments: number;
    namespaces: string[];
    retrievalDuration?: number;
    retrievedAt?: string;
  };

  @Prop({ type: Object })
  @ApiProperty({ 
    description: "User tone profile used for reply generation",
    type: Object,
    example: {
      userId: "user-123",
      userEmail: "user@company.com",
      communicationStyle: {
        formality: "formal",
        warmth: "warm",
        urgency: "normal",
        directness: "balanced"
      },
      confidence: 0.8
    }
  })
  userToneProfile?: {
    userId: string;
    userEmail: string;
    communicationStyle: any;
    preferredTones: string[];
    commonPhrases: string[];
    responsePatterns: any;
    lastUpdated: Date;
    sampleCount: number;
    confidence: number;
  };

  @Prop({ type: Array })
  @ApiProperty({ description: "Any errors that occurred during triage" })
  triageErrors?: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;

  @Prop({ type: String })
  @ApiProperty({ description: "Source of the email triage trigger" })
  source?: string;

  @Prop({ type: Object })
  @ApiProperty({ 
    description: "Additional metadata about the triage session",
    type: Object
  })
  metadata?: Record<string, any>;

  @Prop()
  @ApiProperty({ description: "When the session was created" })
  createdAt?: Date;

  @Prop()
  @ApiProperty({ description: "When the session was last updated" })
  updatedAt?: Date;
}

export const EmailTriageSessionSchema = SchemaFactory.createForClass(EmailTriageSession);

// Create indexes for efficient queries
EmailTriageSessionSchema.index({ sessionId: 1 }, { unique: true });
EmailTriageSessionSchema.index({ userId: 1 });
EmailTriageSessionSchema.index({ emailId: 1 });
EmailTriageSessionSchema.index({ status: 1 });
EmailTriageSessionSchema.index({ createdAt: 1 });
EmailTriageSessionSchema.index({ userId: 1, status: 1 }); // Compound index for user queries
EmailTriageSessionSchema.index({ userId: 1, createdAt: -1 }); // Compound index for user history 
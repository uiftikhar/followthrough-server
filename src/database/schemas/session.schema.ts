import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { ApiProperty } from "@nestjs/swagger";

export type SessionDocument = Session & Document;

@Schema({ timestamps: true, suppressReservedKeysWarning: true })
export class Session {
  @Prop({ required: true })
  @ApiProperty({ description: "Unique session identifier" })
  sessionId: string;

  @Prop({ required: true })
  @ApiProperty({ description: "User ID who created the session" })
  userId: string;

  @Prop({
    required: true,
    enum: ["pending", "in_progress", "completed", "failed"],
    default: "pending",
  })
  @ApiProperty({
    description: "Current status of the session",
    enum: ["pending", "in_progress", "completed", "failed"],
  })
  status: string;

  @Prop({ type: Number, default: 0 })
  @ApiProperty({
    description: "Progress percentage of the analysis (0-100)",
    minimum: 0,
    maximum: 100,
  })
  progress?: number;

  @Prop({ type: Date, required: true })
  @ApiProperty({ description: "When the session was created" })
  startTime: Date;

  @Prop({ type: Date })
  @ApiProperty({ description: "When the session was completed or failed" })
  endTime?: Date;

  @Prop({ type: Object })
  @ApiProperty({ description: "The transcript text that was analyzed" })
  transcript?: string;

  @Prop({ type: Object })
  @ApiProperty({ description: "Additional metadata about the session" })
  metadata?: Record<string, any>;

  @Prop({ type: Array, default: [] })
  @ApiProperty({ 
    description: "Topics extracted from the transcript",
    type: [Object],
    example: [{
      name: "Production Bug Resolution",
      description: "Discussion of critical production bug affecting B2B users",
      relevance: 9,
      subtopics: ["Root cause analysis", "Immediate fixes"],
      keywords: ["production bug", "CRM sync"],
      participants: ["Emily", "Adrian", "Sophia"],
      duration: "25 minutes"
    }]
  })
  topics?: Array<{
    name: string;
    description?: string;
    relevance?: number;
    subtopics?: string[];
    keywords?: string[];
    participants?: string[];
    duration?: string;
  }>;

  @Prop({ type: Array, default: [] })
  @ApiProperty({ 
    description: "Action items extracted from the transcript",
    type: [Object],
    example: [{
      description: "Debug and patch backend mapping logic",
      assignee: "Emily and Adrian",
      deadline: "EOD today",
      status: "pending",
      context: "Critical production bug needs immediate resolution"
    }]
  })
  actionItems?: Array<{
    description: string;
    assignee?: string;
    deadline?: string;
    status?: string;
    priority?: string;
    context?: string;
  }>;

  @Prop({ type: Object })
  @ApiProperty({ 
    description: "Generated summary of the transcript",
    type: Object,
    example: {
      meetingTitle: "Production Bug Resolution",
      summary: "Meeting focused on addressing critical production bug...",
      decisions: [
        {
          title: "Deploy Hotfix by End of Day",
          content: "Team decided to deploy a hotfix by EOD..."
        }
      ]
    }
  })
  summary?: {
    meetingTitle?: string;
    summary?: string;
    decisions?: Array<{
      title: string;
      content: string;
    }>;
    next_steps?: string[];
  };

  @Prop({ type: Object })
  @ApiProperty({ 
    description: "Sentiment analysis results",
    type: Object,
    example: {
      overall: 0.6,
      segments: [
        {
          text: "Good morning, everyone...",
          score: 0.8
        }
      ]
    }
  })
  sentiment?: {
    overall?: number;
    segments?: Array<{
      text: string;
      score: number;
    }>;
  };

  @Prop({ type: Array })
  @ApiProperty({ description: "Any errors that occurred during analysis" })
  analysisErrors?: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;

  @Prop()
  @ApiProperty({ description: "When the session was created" })
  createdAt?: Date;

  @Prop()
  @ApiProperty({ description: "When the session was last updated" })
  updatedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

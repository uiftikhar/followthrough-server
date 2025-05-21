import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type MeetingDocument = Meeting & Document;

@Schema({ timestamps: true })
export class Meeting {
  @Prop({ type: String, default: () => uuidv4() })
  meetingId: string;

  @Prop({ required: true })
  transcript: string;

  @Prop({ type: [Object] })
  topics: Array<{
    title: string;
    summary: string;
    keywords: string[];
    confidence: number;
  }>;

  @Prop({ type: [Object] })
  actionItems: Array<{
    description: string;
    assignee: string;
    dueDate?: Date;
    priority: string;
    status: string;
  }>;

  @Prop({ type: Object })
  sentiment: {
    overall: string;
    score: number;
    segments: Array<{
      text: string;
      sentiment: string;
      score: number;
    }>;
  };

  @Prop({ type: Object })
  summary: {
    brief: string;
    detailed: string;
    keyPoints: string[];
    decisions: string[];
  };

  @Prop({ type: [Object] })
  participants: Array<{
    name: string;
    speakingTime: number;
    contributions: number;
    sentiment: string;
  }>;

  @Prop({ default: 'pending' })
  status: string;

  @Prop({ type: [Object] })
  analysisErrors: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;

  @Prop()
  sessionId: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);

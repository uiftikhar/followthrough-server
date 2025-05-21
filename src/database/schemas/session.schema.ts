import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session {
  @Prop({ required: true })
  @ApiProperty({ description: 'Unique session identifier' })
  sessionId: string;

  @Prop({ required: true })
  @ApiProperty({ description: 'User ID who created the session' })
  userId: string;

  @Prop({
    required: true,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
  })
  @ApiProperty({
    description: 'Current status of the session',
    enum: ['pending', 'in_progress', 'completed', 'failed'],
  })
  status: string;

  @Prop({ type: Date, required: true })
  @ApiProperty({ description: 'When the session was created' })
  startTime: Date;

  @Prop({ type: Date })
  @ApiProperty({ description: 'When the session was completed or failed' })
  endTime?: Date;

  @Prop({ type: Object })
  @ApiProperty({ description: 'The transcript text that was analyzed' })
  transcript?: string;

  @Prop({ type: Object })
  @ApiProperty({ description: 'Additional metadata about the session' })
  metadata?: Record<string, any>;

  @Prop({ type: Object })
  @ApiProperty({ description: 'Topics extracted from the transcript' })
  topics?: any[];

  @Prop({ type: Object })
  @ApiProperty({ description: 'Action items extracted from the transcript' })
  actionItems?: any[];

  @Prop({ type: Object })
  @ApiProperty({ description: 'Generated summary of the transcript' })
  summary?: any;

  @Prop({ type: Object })
  @ApiProperty({ description: 'Sentiment analysis results' })
  sentiment?: any;

  @Prop({ type: Array })
  @ApiProperty({ description: 'Any errors that occurred during analysis' })
  errors?: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;

  @Prop()
  @ApiProperty({ description: 'When the session was created' })
  createdAt?: Date;

  @Prop()
  @ApiProperty({ description: 'When the session was last updated' })
  updatedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session); 
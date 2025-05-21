import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Topic } from '../../agents/topic-extraction.agent';
import { ActionItem } from '../../agents/action-item.agent';
import { SentimentAnalysis } from '../../agents/sentiment-analysis.agent';
import { MeetingSummary } from '../../agents/summary.agent';

export class AnalysisErrorDto {
  @ApiProperty({ description: 'Step where the error occurred' })
  step: string;

  @ApiProperty({ description: 'Error message' })
  error: string;

  @ApiProperty({ description: 'Timestamp when the error occurred' })
  timestamp: string;
}

export class AnalysisResultDto {
  @ApiProperty({ description: 'Unique session ID for this analysis' })
  sessionId: string;

  @ApiProperty({
    description: 'Status of the analysis',
    enum: ['pending', 'in_progress', 'completed', 'failed'],
  })
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  @ApiPropertyOptional({
    description: 'Timestamp when the analysis was started',
  })
  createdAt?: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the analysis was completed',
  })
  completedAt?: Date;

  @ApiPropertyOptional({
    description: 'The analyzed meeting transcript',
    type: String,
  })
  transcript?: string;

  @ApiPropertyOptional({
    description: 'Topics identified in the meeting',
    type: [Object],
  })
  topics?: Topic[];

  @ApiPropertyOptional({
    description: 'Action items identified in the meeting',
    type: [Object],
  })
  actionItems?: ActionItem[];

  @ApiPropertyOptional({
    description: 'Sentiment analysis of the meeting',
    type: Object,
  })
  sentiment?: SentimentAnalysis;

  @ApiPropertyOptional({
    description: 'Meeting summary',
    type: Object,
  })
  summary?: MeetingSummary;

  @ApiPropertyOptional({
    description: 'Errors encountered during analysis',
    type: [AnalysisErrorDto],
  })
  errors?: AnalysisErrorDto[];

  @ApiPropertyOptional({ description: 'Additional information or message' })
  message?: string;
}

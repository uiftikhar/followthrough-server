import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyzeTranscriptDto {
  @ApiProperty({
    description: 'The meeting transcript content to analyze',
    example: "John: Hi everyone, let's discuss our Q3 goals...",
  })
  @IsString()
  @IsNotEmpty()
  transcript: string;

  @ApiPropertyOptional({
    description:
      'Optional metadata about the meeting (date, participants, etc.)',
    example: {
      date: '2023-09-15',
      participants: ['John', 'Mary', 'Alex'],
      duration: 3600,
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

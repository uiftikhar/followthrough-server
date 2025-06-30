import { IsString, IsOptional, IsEnum, IsArray, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateAudioFromTranscriptDto {
  @ApiProperty({ description: 'Raw transcript text with speaker labels' })
  @IsString()
  transcript_text: string;

  @ApiProperty({ description: 'Unique meeting identifier' })
  @IsString()
  meeting_id: string;

  @ApiPropertyOptional({ 
    description: 'Type of meeting',
    enum: ['product_planning', 'bug_triage', 'design_review', 'sprint_planning', 'general_meeting', 'cross_team_refinement']
  })
  @IsOptional()
  @IsEnum(['product_planning', 'bug_triage', 'design_review', 'sprint_planning', 'general_meeting', 'cross_team_refinement'])
  meeting_type?: string;

  @ApiPropertyOptional({ description: 'Output audio format', enum: ['mp3', 'wav'] })
  @IsOptional()
  @IsEnum(['mp3', 'wav'])
  output_format?: 'mp3' | 'wav' = 'mp3';
}

export class GenerateAudioFromFileDto {
  @ApiProperty({ description: 'Path to transcript file' })
  @IsString()
  file_path: string;

  @ApiPropertyOptional({ description: 'Output audio format', enum: ['mp3', 'wav'] })
  @IsOptional()
  @IsEnum(['mp3', 'wav'])
  output_format?: 'mp3' | 'wav' = 'mp3';
}

export class VoiceAssignmentDto {
  @ApiProperty({ description: 'Speaker name' })
  @IsString()
  speaker_name: string;

  @ApiProperty({ description: 'ElevenLabs voice ID' })
  @IsString()
  voice_id: string;

  @ApiPropertyOptional({ description: 'Voice gender', enum: ['male', 'female'] })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: 'male' | 'female';
}

export class GenerateAudioWithCustomVoicesDto extends GenerateAudioFromTranscriptDto {
  @ApiPropertyOptional({ 
    description: 'Custom voice assignments for speakers',
    type: [VoiceAssignmentDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoiceAssignmentDto)
  voice_assignments?: VoiceAssignmentDto[];
}

export class AudioGenerationStatusDto {
  @ApiProperty({ description: 'Generation job ID' })
  @IsString()
  job_id: string;
}

export class BatchGenerateAudioDto {
  @ApiProperty({ 
    description: 'Array of transcript files to process',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  file_paths: string[];

  @ApiPropertyOptional({ description: 'Output audio format', enum: ['mp3', 'wav'] })
  @IsOptional()
  @IsEnum(['mp3', 'wav'])
  output_format?: 'mp3' | 'wav' = 'mp3';
} 
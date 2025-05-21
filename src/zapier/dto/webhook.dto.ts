import { IsNotEmpty, IsString, IsObject, IsOptional } from 'class-validator';

export class WebhookRequestDto {
  @IsNotEmpty()
  @IsString()
  event: string;

  @IsNotEmpty()
  @IsObject()
  payload: Record<string, any>;
}

export class GenerateApiKeyDto {
  @IsNotEmpty()
  @IsString()
  userId: string;
}

export class RevokeApiKeyDto {
  @IsNotEmpty()
  @IsString()
  apiKey: string;
}

export class TaskCreateDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  assignee?: string;

  @IsString()
  @IsOptional()
  priority?: string;
}

export class MeetingScheduleDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNotEmpty()
  @IsString()
  startTime: string;

  @IsNotEmpty()
  @IsString()
  endTime: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsObject()
  @IsOptional()
  attendees?: Record<string, any>[];
} 
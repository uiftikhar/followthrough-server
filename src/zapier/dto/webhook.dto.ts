import { IsNotEmpty, IsString, IsObject, IsOptional, IsArray, IsDateString, MaxLength } from "class-validator";

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
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class RevokeApiKeyDto {
  @IsNotEmpty()
  @IsString()
  apiKey: string;
}

export class RevokeApiKeyByIdDto {
  @IsNotEmpty()
  @IsString()
  keyId: string;
}

export class UpdateApiKeyDto {
  @IsNotEmpty()
  @IsString()
  keyId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
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

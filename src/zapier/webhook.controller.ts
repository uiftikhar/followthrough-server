import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  HttpCode, 
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ZapierService } from './zapier.service';
import { WebhookRequestDto, TaskCreateDto, MeetingScheduleDto } from './dto/webhook.dto';
import { ZapierApiKeyGuard } from './guards/api-key.guard';

@Controller('api/zapier/webhooks')
export class WebhookController {
  constructor(private readonly zapierService: ZapierService) {}

  @Post()
  @UseGuards(ZapierApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async processWebhook(@Body(ValidationPipe) webhookDto: WebhookRequestDto) {
    return this.zapierService.handleWebhook(webhookDto.payload, webhookDto.event);
  }

  @Post('task')
  @UseGuards(ZapierApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async createTask(@Body(ValidationPipe) taskDto: TaskCreateDto) {
    return this.zapierService.handleWebhook(taskDto, 'task.created');
  }

  @Post('meeting')
  @UseGuards(ZapierApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async scheduleMeeting(@Body(ValidationPipe) meetingDto: MeetingScheduleDto) {
    return this.zapierService.handleWebhook(meetingDto, 'meeting.scheduled');
  }
} 
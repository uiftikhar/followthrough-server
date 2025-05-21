import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ZapierService } from './zapier.service';
import { ZapierApiKeyGuard } from './guards/api-key.guard';

@Controller('api/zapier/triggers')
export class TriggerController {
  constructor(private readonly zapierService: ZapierService) {}

  @Get('tasks')
  @UseGuards(ZapierApiKeyGuard)
  async getTasks(
    @Query('since') since: string,
    @Req() req: any,
  ) {
    // This endpoint would return tasks created after the 'since' timestamp
    // The implementation is a placeholder and should be customized with actual business logic
    const date = since ? new Date(since) : new Date(0);
    
    // Mock data for demonstration
    return [
      {
        id: 'task-123',
        title: 'Complete project proposal',
        description: 'Create a detailed proposal for the new client project',
        dueDate: '2023-12-01',
        assignee: 'user-456',
        priority: 'high',
        status: 'open',
        createdAt: '2023-11-15T10:30:00Z'
      }
    ];
  }

  @Get('meetings')
  @UseGuards(ZapierApiKeyGuard)
  async getMeetings(
    @Query('since') since: string,
    @Req() req: any,
  ) {
    // This endpoint would return meetings created after the 'since' timestamp
    // The implementation is a placeholder and should be customized with actual business logic
    const date = since ? new Date(since) : new Date(0);
    
    // Mock data for demonstration
    return [
      {
        id: 'meeting-789',
        title: 'Project Kickoff',
        description: 'Initial meeting to discuss project scope and timeline',
        startTime: '2023-12-05T14:00:00Z',
        endTime: '2023-12-05T15:00:00Z',
        location: 'Virtual - Zoom',
        attendees: [
          {name: 'Jane Doe', email: 'jane@example.com'},
          {name: 'John Smith', email: 'john@example.com'}
        ],
        createdAt: '2023-11-28T09:15:00Z'
      }
    ];
  }
} 
# Zapier Integration Developer Guide

This guide is for developers who want to extend the Zapier integration with new triggers and actions.

## Architecture Overview

The Zapier integration consists of these main components:

1. **ZapierModule**: The main NestJS module that wraps all Zapier functionality
2. **ZapierService**: Contains core business logic for API key management and webhook handling
3. **ZapierApiKeyGuard**: Protects endpoints by validating API keys
4. **ZapierController**: Manages API keys
5. **WebhookController**: Handles incoming webhooks from Zapier

## Adding New Triggers

Triggers allow your users to start a Zap when something happens in your application.

### Steps to Add a New Trigger:

1. **Create a new DTO** in `nestjs-server/src/zapier/dto/webhook.dto.ts`
2. **Add a new endpoint** in `nestjs-server/src/zapier/zapier.controller.ts` to expose the data
3. **Implement data fetching** logic in `nestjs-server/src/zapier/zapier.service.ts`
4. **Update the Zapier integration** in the Zapier Developer Platform

### Example: Adding a "New Comment" Trigger

```typescript
// 1. Create DTO
export class CommentDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsString()
  authorId: string;

  @IsNotEmpty()
  @IsString()
  postId: string;

  @IsNotEmpty()
  @IsString()
  createdAt: string;
}

// 2. Add controller endpoint
@Controller('api/zapier/triggers')
export class ZapierTriggerController {
  constructor(private readonly zapierService: ZapierService) {}

  @Get('comments')
  @UseGuards(ZapierApiKeyGuard)
  async getComments(@Query('since') since: string) {
    return this.zapierService.getCommentsAfter(since);
  }
}

// 3. Implement service method
@Injectable()
export class ZapierService {
  // ... existing code

  async getCommentsAfter(since: string): Promise<CommentDto[]> {
    // Implement query logic
    const date = since ? new Date(since) : new Date(0);
    return this.commentRepository.findAfterDate(date);
  }
}
```

## Adding New Actions

Actions allow your users to create or update data in your application from another app.

### Steps to Add a New Action:

1. **Create a new DTO** in `nestjs-server/src/zapier/dto/webhook.dto.ts`
2. **Add a new endpoint** in `nestjs-server/src/zapier/webhook.controller.ts`
3. **Implement action handling** in `nestjs-server/src/zapier/zapier.service.ts`
4. **Update the Zapier integration** in the Zapier Developer Platform

### Example: Adding a "Create Comment" Action

```typescript
// 1. Create DTO
export class CreateCommentDto {
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsString()
  postId: string;

  @IsOptional()
  @IsString()
  authorId?: string;
}

// 2. Add controller endpoint
@Controller('api/zapier/webhooks')
export class WebhookController {
  // ... existing code

  @Post('comment')
  @UseGuards(ZapierApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async createComment(@Body(ValidationPipe) commentDto: CreateCommentDto, @Req() req: any) {
    return this.zapierService.handleWebhook(
      { ...commentDto, authorId: req.userId }, 
      'comment.created'
    );
  }
}

// 3. Implement service method
@Injectable()
export class ZapierService {
  // ... existing code

  private async handleCommentCreated(payload: any): Promise<any> {
    // Implement comment creation logic
    const newComment = await this.commentRepository.create({
      content: payload.content,
      postId: payload.postId,
      authorId: payload.authorId,
    });
    return { 
      status: 'success', 
      message: 'Comment created', 
      commentId: newComment.id 
    };
  }

  async handleWebhook(payload: any, event: string): Promise<any> {
    // ... existing code
    switch (event) {
      // ... existing cases
      case 'comment.created':
        return this.handleCommentCreated(payload);
      default:
        // ... existing code
    }
  }
}
```

## Authentication Extensions

The current implementation uses API keys for authentication. If you need more advanced authentication:

### Using OAuth 2.0

1. Implement an OAuth provider in your NestJS application
2. Update the Zapier integration to use OAuth 2.0 authentication
3. Create the OAuth endpoints in your application

## Testing Your Integration

Always test your integration thoroughly:

1. Use Zapier's developer tools to test new triggers and actions
2. Test edge cases and error handling
3. Validate that data formats match between your API and Zapier

## Deployment Notes

When deploying updates:

1. Make sure your API is accessible from the internet
2. Update environment variables for production
3. Version your API endpoints to avoid breaking existing Zaps
4. Consider rate limiting to prevent abuse 
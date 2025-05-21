import { Controller, Post, Body, Get, Delete, UseGuards, Req } from '@nestjs/common';
import { ZapierService } from './zapier.service';
import { GenerateApiKeyDto, RevokeApiKeyDto } from './dto/webhook.dto';
import { ZapierApiKeyGuard } from './guards/api-key.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/zapier')
export class ZapierController {
  constructor(private readonly zapierService: ZapierService) {}

  @Post('api-key')
  @UseGuards(AuthGuard('jwt'))
  generateApiKey(@Body() generateApiKeyDto: GenerateApiKeyDto, @Req() req: any) {
    // Use authenticated user's ID instead of passed userId for security
    const userId = req.user.id;
    const apiKey = this.zapierService.generateApiKey(userId);
    return { apiKey };
  }

  @Delete('api-key')
  @UseGuards(AuthGuard('jwt'))
  revokeApiKey(@Body() revokeApiKeyDto: RevokeApiKeyDto, @Req() req: any) {
    // Only admin or the key owner can revoke it
    const result = this.zapierService.revokeApiKey(revokeApiKeyDto.apiKey);
    return { success: result };
  }

  @Get('api-keys')
  @UseGuards(AuthGuard('jwt'))
  listApiKeys(@Req() req: any) {
    const userId = req.user.id;
    const apiKeys = this.zapierService.listApiKeysForUser(userId);
    return { apiKeys };
  }

  @Get('test')
  @UseGuards(ZapierApiKeyGuard)
  testApiKey(@Req() req: any) {
    return {
      status: 'success',
      message: 'API key is valid',
      userId: req.userId,
    };
  }
} 
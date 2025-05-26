import { Controller, Post, Body, Get, Delete, Patch, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ZapierService } from './zapier.service';
import { GenerateApiKeyDto, RevokeApiKeyDto, RevokeApiKeyByIdDto, UpdateApiKeyDto } from './dto/webhook.dto';
import { ZapierApiKeyGuard } from './guards/api-key.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/zapier')
export class ZapierController {
  constructor(private readonly zapierService: ZapierService) {}

  /**
   * Generate a new API key for the authenticated user
   */
  @Post('api-key')
  @UseGuards(AuthGuard('jwt'))
  async generateApiKey(@Body() generateApiKeyDto: GenerateApiKeyDto, @Req() req: any) {
    try {
      // Use authenticated user's ID for security
      const userId = req.user.id;
      
      const result = await this.zapierService.generateApiKey({
        userId,
        name: generateApiKeyDto.name,
        description: generateApiKeyDto.description,
        permissions: generateApiKeyDto.permissions,
        expiresAt: generateApiKeyDto.expiresAt ? new Date(generateApiKeyDto.expiresAt) : undefined,
      });

      return {
        success: true,
        apiKey: result.apiKey, // Full key - only shown once
        keyId: result.keyId,
        displayKey: result.displayKey,
        message: 'API key generated successfully. Please save this key as it will not be shown again.',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate API key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Revoke an API key by the actual key value
   */
  @Delete('api-key')
  @UseGuards(AuthGuard('jwt'))
  async revokeApiKey(@Body() revokeApiKeyDto: RevokeApiKeyDto, @Req() req: any) {
    try {
      const userId = req.user.id;
      const result = await this.zapierService.revokeApiKey(revokeApiKeyDto.apiKey, userId);
      
      return {
        success: result,
        message: result ? 'API key revoked successfully' : 'API key not found or already revoked',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to revoke API key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Revoke an API key by ID (safer for UI operations)
   */
  @Delete('api-key/:keyId')
  @UseGuards(AuthGuard('jwt'))
  async revokeApiKeyById(@Req() req: any) {
    try {
      const userId = req.user.id;
      const keyId = req.params.keyId;
      
      const result = await this.zapierService.revokeApiKeyById(keyId, userId);
      
      return {
        success: result,
        message: result ? 'API key revoked successfully' : 'API key not found or already revoked',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to revoke API key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update API key metadata
   */
  @Patch('api-key')
  @UseGuards(AuthGuard('jwt'))
  async updateApiKey(@Body() updateApiKeyDto: UpdateApiKeyDto, @Req() req: any) {
    try {
      const userId = req.user.id;
      
      const result = await this.zapierService.updateApiKey(
        updateApiKeyDto.keyId,
        userId,
        {
          name: updateApiKeyDto.name,
          description: updateApiKeyDto.description,
          permissions: updateApiKeyDto.permissions,
        }
      );

      if (!result) {
        throw new HttpException(
          'API key not found or update failed',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        apiKey: result,
        message: 'API key updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update API key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List all API keys for the authenticated user
   */
  @Get('api-keys')
  @UseGuards(AuthGuard('jwt'))
  async listApiKeys(@Req() req: any) {
    try {
      const userId = req.user.id;
      const apiKeys = await this.zapierService.listApiKeysForUser(userId);
      const stats = await this.zapierService.getApiKeyStats(userId);

      return {
        success: true,
        apiKeys,
        stats,
        count: apiKeys.length,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to list API keys: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get API key statistics for the authenticated user
   */
  @Get('api-keys/stats')
  @UseGuards(AuthGuard('jwt'))
  async getApiKeyStats(@Req() req: any) {
    try {
      const userId = req.user.id;
      const stats = await this.zapierService.getApiKeyStats(userId);

      return {
        success: true,
        stats,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get API key statistics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test API key validity
   */
  @Get('test')
  @UseGuards(ZapierApiKeyGuard)
  testApiKey(@Req() req: any) {
    return {
      status: 'success',
      message: 'API key is valid',
      userId: req.userId,
      apiKeyInfo: {
        name: req.apiKeyDocument?.name,
        permissions: req.apiKeyDocument?.permissions,
        lastUsedAt: req.apiKeyDocument?.lastUsedAt,
        usageCount: req.apiKeyDocument?.usageCount,
      },
    };
  }
} 
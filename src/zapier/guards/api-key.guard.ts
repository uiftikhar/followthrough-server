import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { ZapierService } from "../zapier.service";

@Injectable()
export class ZapierApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ZapierApiKeyGuard.name);

  constructor(private readonly zapierService: ZapierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract API key from headers, query params, or request body
    const apiKey =
      this.extractFromHeader(request) ||
      this.extractFromQuery(request) ||
      this.extractFromBody(request);

    if (!apiKey) {
      this.logger.warn('API key is missing from request', {
        ip: this.getClientIp(request),
        userAgent: request.headers['user-agent'],
        url: request.url
      });
      throw new UnauthorizedException("API key is missing");
    }

    // Extract client IP for security tracking
    const clientIp = this.getClientIp(request);

    try {
      // Validate the API key (async)
      const isValid = await this.zapierService.validateApiKey(apiKey, clientIp);
      
      if (!isValid) {
        this.logger.warn('Invalid API key attempted', {
          apiKeyPrefix: apiKey.substring(0, 8),
          ip: clientIp,
          userAgent: request.headers['user-agent'],
          url: request.url
        });
        throw new UnauthorizedException("Invalid API key");
      }

      // Get userId and add to request for later use (async)
      const userId = await this.zapierService.getUserIdFromApiKey(apiKey);
      request.userId = userId;
      
      // Also add the API key document for detailed operations if needed
      const apiKeyDocument = await this.zapierService.getApiKeyDocument(apiKey);
      request.apiKeyDocument = apiKeyDocument;

      this.logger.debug('API key validation successful', {
        userId,
        apiKeyPrefix: apiKey.substring(0, 8),
        ip: clientIp,
        url: request.url
      });

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      this.logger.error('Error during API key validation', {
        error: error.message,
        apiKeyPrefix: apiKey.substring(0, 8),
        ip: clientIp,
        url: request.url
      });
      
      throw new UnauthorizedException("API key validation failed");
    }
  }

  private extractFromHeader(request: any): string | null {
    return request.headers["x-api-key"] || null;
  }

  private extractFromQuery(request: any): string | null {
    return request.query.apiKey || null;
  }

  private extractFromBody(request: any): string | null {
    return request.body?.apiKey || null;
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}

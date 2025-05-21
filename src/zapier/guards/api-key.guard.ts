import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ZapierService } from '../zapier.service';

@Injectable()
export class ZapierApiKeyGuard implements CanActivate {
  constructor(private readonly zapierService: ZapierService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Extract API key from headers, query params, or request body
    const apiKey = 
      this.extractFromHeader(request) || 
      this.extractFromQuery(request) || 
      this.extractFromBody(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }

    // Validate the API key
    const isValid = this.zapierService.validateApiKey(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Add userId to request for later use
    request.userId = this.zapierService.getUserIdFromApiKey(apiKey);
    return true;
  }

  private extractFromHeader(request: any): string | null {
    return request.headers['x-api-key'] || null;
  }

  private extractFromQuery(request: any): string | null {
    return request.query.apiKey || null;
  }

  private extractFromBody(request: any): string | null {
    return request.body?.apiKey || null;
  }
} 
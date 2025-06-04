import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { GoogleOAuthService } from "../services/google-oauth.service";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    [key: string]: any;
  };
  googleClient?: any; // Will be set by this guard
}

@Injectable()
export class GoogleAuthGuard implements CanActivate {
  private readonly logger = new Logger(GoogleAuthGuard.name);

  constructor(private readonly googleOAuthService: GoogleOAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // This guard assumes JWT authentication has already been validated
    if (!request.user || !request.user.id) {
      this.logger.warn("GoogleAuthGuard: No authenticated user found");
      throw new UnauthorizedException("User authentication required");
    }

    const userId = request.user.id;

    try {
      // Check if user is connected to Google
      const isConnected = await this.googleOAuthService.isConnected(userId);

      if (!isConnected) {
        this.logger.warn(
          `GoogleAuthGuard: User ${userId} not connected to Google`,
        );
        throw new UnauthorizedException(
          "Google OAuth connection required. Please connect your Google account first.",
        );
      }

      // Get authenticated Google client
      const googleClient =
        await this.googleOAuthService.getAuthenticatedClient(userId);

      // Add the Google client to the request for use in controllers
      request.googleClient = googleClient;

      this.logger.debug(`GoogleAuthGuard: Access granted for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `GoogleAuthGuard: Access denied for user ${userId}:`,
        error,
      );

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // If token refresh failed or other issues
      throw new UnauthorizedException(
        "Google authentication failed. Please reconnect your Google account.",
      );
    }
  }
}

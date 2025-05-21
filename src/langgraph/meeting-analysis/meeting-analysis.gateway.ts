import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsResponse,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards, Logger, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MeetingAnalysisService, AnalysisProgressEvent } from './meeting-analysis.service';
import { OnEvent } from '@nestjs/event-emitter';

interface SubscribeResponse {
  status: string;
  sessionId?: string;
  message?: string;
}

@WebSocketGateway({
  namespace: 'meeting-analysis',
  cors: {
    origin: '*',
  },
})
export class MeetingAnalysisGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(MeetingAnalysisGateway.name);
  private readonly sessions = new Map<string, Set<string>>();

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly meetingAnalysisService: MeetingAnalysisService,
  ) {}

  onModuleInit() {
    this.logger.log('Meeting Analysis WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Cleanup client subscriptions
    for (const [sessionId, clients] of this.sessions.entries()) {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        this.logger.log(
          `Unsubscribed client ${client.id} from session ${sessionId}`,
        );
      }
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    payload: { sessionId: string },
  ): WsResponse<SubscribeResponse> {
    const { sessionId } = payload;

    if (!sessionId) {
      return {
        event: 'error',
        data: { status: 'error', message: 'Session ID is required' },
      };
    }

    // Create or update session subscribers
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Set<string>());
    }

    this.sessions.get(sessionId)!.add(client.id);

    this.logger.log(`Client ${client.id} subscribed to session ${sessionId}`);

    return { event: 'subscribed', data: { status: 'success', sessionId } };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    payload: { sessionId: string },
  ): WsResponse<SubscribeResponse> {
    const { sessionId } = payload;

    if (!sessionId) {
      return {
        event: 'error',
        data: { status: 'error', message: 'Session ID is required' },
      };
    }

    // Remove client from session subscribers
    if (this.sessions.has(sessionId)) {
      this.sessions.get(sessionId)!.delete(client.id);
      this.logger.log(
        `Client ${client.id} unsubscribed from session ${sessionId}`,
      );
    }

    return { event: 'unsubscribed', data: { status: 'success', sessionId } };
  }

  /**
   * Listen for analysis progress events and publish to subscribers
   */
  @OnEvent('analysis.progress')
  handleAnalysisProgressEvent(event: AnalysisProgressEvent) {
    this.logger.debug(`Received progress event for session ${event.sessionId}`);
    this.publishProgressUpdate(event);
  }

  /**
   * Publish a progress update to all subscribers of a session
   */
  publishProgressUpdate(update: AnalysisProgressEvent): void {
    const { sessionId } = update;

    if (!this.sessions.has(sessionId)) {
      return;
    }

    const clients = this.sessions.get(sessionId)!;

    if (clients.size === 0) {
      return;
    }

    this.logger.log(
      `Publishing update for session ${sessionId} to ${clients.size} clients`,
    );

    // Emit to specific clients
    for (const clientId of clients) {
      this.server.to(clientId).emit('analysis_progress', update);
    }
  }
}

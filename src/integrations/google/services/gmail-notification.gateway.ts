import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

/**
 * Gmail Notification Gateway
 * Provides real-time WebSocket notifications for Gmail push notifications and email triage results
 */
@WebSocketGateway({
  namespace: '/gmail-notifications',
  cors: {
    origin: [
      'http://localhost:8080',
      'http://localhost:3000',
      'https://followthrough-client.vercel.app',
      'https://followthrough-client-uiftikhars-projects.vercel.app',
      'https://followthrough-client-uiftikhar-uiftikhars-projects.vercel.app',
      'https://ffdf-2-201-41-78.ngrok-free.app',
    ], // Add your client origins
    credentials: true,
  },
})
export class GmailNotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GmailNotificationGateway.name);
  private readonly connectedClients = new Map<string, Socket>();

  /**
   * Handle client connection
   */
  handleConnection(client: Socket) {
    const clientId = client.id;
    this.connectedClients.set(clientId, client);
    this.logger.log(`Client connected: ${clientId}`);

    // Send connection confirmation
    client.emit('connected', {
      message: 'Connected to Gmail notifications',
      clientId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    const clientId = client.id;
    this.connectedClients.delete(clientId);
    this.logger.log(`Client disconnected: ${clientId}`);
  }

  /**
   * Subscribe to email notifications for a specific user
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { userId: string; emailAddress?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, emailAddress } = data;
    this.logger.log(`Client ${client.id} subscribing to notifications for user: ${userId}`);

    // Join room for this user
    const roomName = `user:${userId}`;
    client.join(roomName);

    // If specific email address provided, join that room too
    if (emailAddress) {
      const emailRoom = `email:${emailAddress}`;
      client.join(emailRoom);
    }

    client.emit('subscribed', {
      message: 'Successfully subscribed to notifications',
      userId,
      emailAddress,
      rooms: [roomName, emailAddress ? `email:${emailAddress}` : null].filter(Boolean),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Unsubscribe from notifications
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { userId: string; emailAddress?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, emailAddress } = data;
    this.logger.log(`Client ${client.id} unsubscribing from notifications for user: ${userId}`);

    // Leave user room
    const roomName = `user:${userId}`;
    client.leave(roomName);

    // Leave email room if specified
    if (emailAddress) {
      const emailRoom = `email:${emailAddress}`;
      client.leave(emailRoom);
    }

    client.emit('unsubscribed', {
      message: 'Successfully unsubscribed from notifications',
      userId,
      emailAddress,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Listen for email triage started events
   */
  @OnEvent('email.triage.started')
  handleTriageStarted(payload: any) {
    this.logger.log(`📡 Broadcasting triage started for email: ${payload.emailId}`);
    
    // Broadcast to all clients in email room
    const emailRoom = `email:${payload.emailAddress}`;
    this.server.to(emailRoom).emit('triage.started', {
      type: 'triage.started',
      emailId: payload.emailId,
      emailAddress: payload.emailAddress,
      subject: payload.subject,
      from: payload.from,
      timestamp: payload.timestamp,
      source: payload.source,
    });
  }

  /**
   * Listen for email triage processing events
   */
  @OnEvent('email.triage.processing')
  handleTriageProcessing(payload: any) {
    this.logger.log(`📡 Broadcasting triage processing for session: ${payload.sessionId}`);
    
    // Broadcast to all clients in email room
    const emailRoom = `email:${payload.emailAddress}`;
    this.server.to(emailRoom).emit('triage.processing', {
      type: 'triage.processing',
      sessionId: payload.sessionId,
      emailId: payload.emailId,
      emailAddress: payload.emailAddress,
      subject: payload.subject,
      status: payload.status,
      timestamp: payload.timestamp,
      source: payload.source,
    });
  }

  /**
   * Listen for email triage completed events
   */
  @OnEvent('email.triage.completed')
  handleTriageCompleted(payload: any) {
    this.logger.log(`📡 Broadcasting triage completed for email: ${payload.emailId}`);
    
    // Broadcast to all clients in email room
    const emailRoom = `email:${payload.emailAddress}`;
    this.server.to(emailRoom).emit('triage.completed', {
      type: 'triage.completed',
      sessionId: payload.sessionId,
      emailId: payload.emailId,
      emailAddress: payload.emailAddress,
      result: payload.result,
      timestamp: payload.timestamp,
      source: payload.source,
    });
  }

  /**
   * Listen for email triage failed events
   */
  @OnEvent('email.triage.failed')
  handleTriageFailed(payload: any) {
    this.logger.log(`📡 Broadcasting triage failed for email: ${payload.emailId}`);
    
    // Broadcast to all clients in email room
    const emailRoom = `email:${payload.emailAddress}`;
    this.server.to(emailRoom).emit('triage.failed', {
      type: 'triage.failed',
      emailId: payload.emailId,
      emailAddress: payload.emailAddress,
      subject: payload.subject,
      error: payload.error,
      timestamp: payload.timestamp,
      source: payload.source,
    });
  }

  /**
   * Listen for email received events (simplified notification)
   */
  @OnEvent('email.received')
  handleEmailReceived(payload: any) {
    this.logger.log(`📡 Broadcasting email received for: ${payload.emailId} - "${payload.subject}"`);
    
    // Broadcast to all clients in email room
    const emailRoom = `email:${payload.emailAddress}`;
    this.server.to(emailRoom).emit('email.received', {
      type: 'email.received',
      emailId: payload.emailId,
      emailAddress: payload.emailAddress,
      subject: payload.subject,
      from: payload.from,
      to: payload.to,
      bodyPreview: payload.body,
      timestamp: payload.timestamp,
      fullEmail: payload.fullEmail,
    });

    // Also broadcast to general notifications for all connected clients
    this.server.emit('notification', {
      type: 'email_received',
      emailId: payload.emailId,
      emailAddress: payload.emailAddress,
      summary: `New email received: "${payload.subject}" from ${payload.from}`,
      timestamp: payload.timestamp,
    });

    this.logger.log(`✅ Email notification broadcasted to clients for: ${payload.emailId}`);
  }

  /**
   * Send test notification (for debugging)
   */
  @SubscribeMessage('test')
  handleTest(@ConnectedSocket() client: Socket) {
    this.logger.log(`Sending test notification to client: ${client.id}`);
    
    client.emit('test.notification', {
      message: 'Test notification from Gmail push notification system',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connection status
   */
  @SubscribeMessage('status')
  handleStatus(@ConnectedSocket() client: Socket) {
    const connectedCount = this.connectedClients.size;
    
    client.emit('status.response', {
      clientId: client.id,
      connectedClients: connectedCount,
      rooms: Array.from(client.rooms),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast system-wide notification
   */
  broadcastSystemNotification(message: string, type: string = 'info') {
    this.logger.log(`Broadcasting system notification: ${message}`);
    
    this.server.emit('system.notification', {
      type,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send notification to specific user
   */
  sendUserNotification(userId: string, notification: any) {
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit('user.notification', {
      ...notification,
      userId,
      timestamp: new Date().toISOString(),
    });
  }
} 
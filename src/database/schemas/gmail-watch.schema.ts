import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type GmailWatchDocument = GmailWatch & Document;

@Schema({ timestamps: true })
export class GmailWatch {
  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  watchId: string;

  @Prop({ required: true })
  historyId: string;

  @Prop({ required: true, default: "gmail-notifications" })
  topicName: string;

  @Prop({ type: [String], default: ["INBOX"] })
  labelIds: string[];

  @Prop({ enum: ["INCLUDE", "EXCLUDE"], default: "INCLUDE" })
  labelFilterBehavior: "INCLUDE" | "EXCLUDE";

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastRenewalAt?: Date;

  @Prop({ default: 0 })
  errorCount: number;

  @Prop()
  lastError?: string;

  @Prop({ required: true })
  googleEmail: string;

  @Prop()
  lastHistoryProcessed?: string;

  @Prop({ default: 0 })
  notificationsReceived: number;

  @Prop({ default: 0 })
  emailsProcessed: number;

  // Timestamps are automatically added by @Schema({ timestamps: true })
  createdAt?: Date;
  updatedAt?: Date;
}

export const GmailWatchSchema = SchemaFactory.createForClass(GmailWatch);

// Create indexes for efficient queries
GmailWatchSchema.index({ userId: 1 });
GmailWatchSchema.index({ watchId: 1 }, { unique: true });
GmailWatchSchema.index({ expiresAt: 1 });
GmailWatchSchema.index({ isActive: 1, expiresAt: 1 });
GmailWatchSchema.index({ googleEmail: 1 });

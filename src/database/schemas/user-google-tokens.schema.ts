import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type UserGoogleTokensDocument = UserGoogleTokens & Document;

@Schema({ timestamps: true, collection: "user_google_tokens" })
export class UserGoogleTokens {
  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  userId: Types.ObjectId;

  @Prop({ required: true, type: String })
  accessTokenEncrypted: string; // AES-256 encrypted access token

  @Prop({ type: String })
  refreshTokenEncrypted?: string; // AES-256 encrypted refresh token

  @Prop({ required: true })
  expiresAt: Date; // Access token expiry

  @Prop({ required: true, type: [String] })
  scope: string[]; // OAuth scopes granted

  @Prop({ required: true })
  googleUserId: string; // Google user ID

  @Prop({ required: true })
  googleEmail: string; // Google email address

  @Prop()
  googleName?: string; // Google display name

  @Prop()
  googlePicture?: string; // Google profile picture URL

  @Prop({ default: true })
  isActive: boolean; // For soft deletion

  @Prop()
  lastUsedAt?: Date; // Track last API usage

  @Prop()
  tokenType: string; // Usually 'Bearer'

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  // Virtual to check if token is expired
  get isExpired(): boolean {
    return new Date() >= this.expiresAt;
  }

  // Virtual to check if token expires soon (within 5 minutes)
  get expiresSoon(): boolean {
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return this.expiresAt <= fiveMinutesFromNow;
  }
}

export const UserGoogleTokensSchema =
  SchemaFactory.createForClass(UserGoogleTokens);

// Indexes for performance and security
UserGoogleTokensSchema.index({ userId: 1 }, { unique: true }); // One token set per user
UserGoogleTokensSchema.index({ googleUserId: 1 });
UserGoogleTokensSchema.index({ googleEmail: 1 });
UserGoogleTokensSchema.index({ isActive: 1 });
UserGoogleTokensSchema.index({ expiresAt: 1 }); // For cleanup queries
UserGoogleTokensSchema.index({ lastUsedAt: -1 }); // For analytics

// TTL index to automatically clean up very old inactive tokens (after 90 days)
UserGoogleTokensSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days
    partialFilterExpression: { isActive: false },
  },
);

// Pre-save middleware to update timestamps
UserGoogleTokensSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Add virtuals for computed properties
UserGoogleTokensSchema.virtual("isExpired").get(function () {
  return new Date() >= this.expiresAt;
});

UserGoogleTokensSchema.virtual("expiresSoon").get(function () {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return this.expiresAt <= fiveMinutesFromNow;
});

// Ensure virtuals are included in JSON output
UserGoogleTokensSchema.set("toJSON", { virtuals: true });
UserGoogleTokensSchema.set("toObject", { virtuals: true });

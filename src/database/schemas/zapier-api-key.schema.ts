import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ZapierApiKeyDocument = ZapierApiKey & Document;

@Schema({ timestamps: true, collection: 'zapier_api_keys' })
export class ZapierApiKey {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  keyHash: string; // SHA-256 hash of the actual API key

  @Prop({ required: true, index: true })
  keyPrefix: string; // First 8 characters for identification (e.g., "zapier_a")

  @Prop({ required: true, maxlength: 100 })
  name: string; // User-friendly name for the API key

  @Prop({ maxlength: 500 })
  description?: string; // Optional description

  @Prop({ default: true, index: true })
  isActive: boolean; // For soft deletion and deactivation

  @Prop({ default: 0 })
  usageCount: number; // Track how many times the key has been used

  @Prop()
  lastUsedAt?: Date; // Track last usage for analytics

  @Prop()
  lastUsedFromIp?: string; // Security tracking

  @Prop({ type: [String], default: ['email:process'] })
  permissions: string[]; // Scopes/permissions for future extensibility

  @Prop()
  expiresAt?: Date; // Optional expiry date

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  // Virtual for displaying partial key to users
  get displayKey(): string {
    return `${this.keyPrefix}...${this.keyHash.slice(-4)}`;
  }
}

export const ZapierApiKeySchema = SchemaFactory.createForClass(ZapierApiKey);

// Indexes for performance
ZapierApiKeySchema.index({ userId: 1, isActive: 1 });
ZapierApiKeySchema.index({ keyHash: 1 }, { unique: true });
ZapierApiKeySchema.index({ keyPrefix: 1 });
ZapierApiKeySchema.index({ createdAt: -1 });
ZapierApiKeySchema.index({ lastUsedAt: -1 });

// TTL index for automatic cleanup of expired keys
ZapierApiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to update timestamps
ZapierApiKeySchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Add virtual for display key
ZapierApiKeySchema.virtual('displayKey').get(function() {
  return `${this.keyPrefix}...${this.keyHash.slice(-4)}`;
});

// Ensure virtuals are included in JSON output
ZapierApiKeySchema.set('toJSON', { virtuals: true });
ZapierApiKeySchema.set('toObject', { virtuals: true }); 
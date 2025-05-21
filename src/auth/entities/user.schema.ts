import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  _id?: Types.ObjectId;
  id?: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  password: string;

  @Prop({ nullable: true })
  refreshToken?: string;

  @Prop({ default: false })
  isAdmin: boolean;

  // Helper method to get full name (provided via virtual property)
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add virtual property for fullName
UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Add a virtual 'id' field that gets the _id as a string
UserSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

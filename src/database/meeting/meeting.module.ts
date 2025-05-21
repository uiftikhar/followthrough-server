import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { MeetingRepository } from '../repositories/meeting.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Meeting.name, schema: MeetingSchema }]),
  ],
  providers: [MeetingRepository],
  exports: [MongooseModule, MeetingRepository],
})
export class MeetingModule {}

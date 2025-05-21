import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';

@Injectable()
export class MeetingRepository {
  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
  ) {}

  async create(meeting: Partial<Meeting>): Promise<Meeting> {
    const createdMeeting = new this.meetingModel(meeting);
    return createdMeeting.save();
  }

  async findAll(): Promise<Meeting[]> {
    return this.meetingModel.find().exec();
  }

  async findById(id: string): Promise<Meeting | null> {
    return this.meetingModel.findById(id).exec();
  }

  async findBySessionId(sessionId: string): Promise<Meeting | null> {
    return this.meetingModel.findOne({ sessionId }).exec();
  }

  async update(id: string, meeting: Partial<Meeting>): Promise<Meeting | null> {
    return this.meetingModel
      .findByIdAndUpdate(id, meeting, { new: true })
      .exec();
  }

  async updateBySessionId(
    sessionId: string,
    meeting: Partial<Meeting>,
  ): Promise<Meeting | null> {
    return this.meetingModel
      .findOneAndUpdate({ sessionId }, meeting, { new: true })
      .exec();
  }

  async remove(id: string): Promise<Meeting | null> {
    return this.meetingModel.findByIdAndDelete(id).exec();
  }
}

import { HttpException, Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { MeetingService } from '../modules/c2m/meeting/meeting.service';

@Injectable()
export class ValidateMeetingRoleMiddleware implements NestMiddleware {
  constructor(private meetingService: MeetingService) {}

  public async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id: meetingId } = req.params;
    if (req.originalUrl.indexOf('/guest') > -1) {
      return next();
    }
    let userId = req.headers['x-sso-uid'];
    let user2ndId = req.headers['x-secondary-id'];
    // req.headers will change to small letter, so use adminid instead
    // let adminId = req.headers['AdminID'];

    const meetingData = await this.meetingService.findMeetingById(meetingId);

    if (!meetingData) {
      throw new HttpException('Can not find meeting data', 400);
    }

    // for cbm -> cancel meeting
    // if (adminId?.length && meetingData?.assignerId === adminId) {
    //   return next();
    // }

    // for c2m -> create / cancel / reschedule / reject / get meeting
    if (meetingData?.requesterSsoUid === userId || meetingData?.responderSsoUid === userId
      || meetingData?.requesterSsoUid === user2ndId || meetingData?.responderSsoUid === user2ndId
      ) {
      return next();
    }

    throw new HttpException('Unauthorized to perform meeting update action', 401);
  }
}

import { Injectable } from '@nestjs/common';
import moment from 'moment-timezone';
import { constant } from '../../../config/constant';
import { TimeslotDto } from '../../../dto/timeslot.dto';
import { Meeting } from '../../../entities/meeting.entity';
import { UnavailableTimeslot } from '../../../entities/unavailableTimeslot.entity';
import { MeetingStatus } from './meeting.type';

@Injectable()
export class MeetingValidator {
  public static validateCreateMeeting(
    requesterSsoUid: string,
    responderSsoUid: string,
    startTime: Date,
    endTime: Date,
    collidedMeetings: Meeting[],
    combinedUnavailableTimeslots: UnavailableTimeslot[]
  ):any {
    if (requesterSsoUid === responderSsoUid) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.SAME_REQUESTER_RESPONDER
      };
    }

    const collidedMeetingsTimeslotDto: TimeslotDto[] = this.mergeTimeslotDto(collidedMeetings);
    const checkMeetingCollided = this.checkCollided(startTime, endTime, collidedMeetingsTimeslotDto);
    if (checkMeetingCollided.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: checkMeetingCollided.status,
        message: checkMeetingCollided.message
      };
    }
    const combinedUnavailableTimeslotDto: TimeslotDto[] = this.mergeTimeslotDto(combinedUnavailableTimeslots);
    const checkCombinedUnavailable = this.checkCollided(startTime, endTime, combinedUnavailableTimeslotDto);
    if (checkCombinedUnavailable.status === constant.GENERAL_STATUS.FAIL) {
    return {
      status: checkCombinedUnavailable.status,
      message: constant.MEETING.ERROR_MESSAGE.NO_VALID_MEETING_TIME
    };
  }

    return {
      status: constant.GENERAL_STATUS.SUCCESS
    };
  }

  public static validateAcceptMeeting(meeting: Meeting, collidedMeetings: Meeting[], combinedUnavailableTimeslots: UnavailableTimeslot[]): any {
    const { startTime, endTime } = meeting;
    const collidedMeetingsTimeslotDto: TimeslotDto[] = this.mergeTimeslotDto(collidedMeetings);
    const checkMeetingCollided = this.checkCollided(startTime, endTime, collidedMeetingsTimeslotDto);
    if (checkMeetingCollided.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: checkMeetingCollided.status,
        message: checkMeetingCollided.message
      };
    }
    const combinedUnavailableTimeslotDto: TimeslotDto[] = this.mergeTimeslotDto(combinedUnavailableTimeslots);
    const checkCombinedUnavailable = this.checkCollided(startTime, endTime, combinedUnavailableTimeslotDto);
    if (checkCombinedUnavailable.status === constant.GENERAL_STATUS.FAIL) {
    return {
      status: checkCombinedUnavailable.status,
      message: constant.MEETING.ERROR_MESSAGE.NO_VALID_MEETING_TIME
      };
    }
    return {
      status: constant.GENERAL_STATUS.SUCCESS
    };
  }

  public static validateRejectMeeting(fields: Record<string, any>): any {
    if (!fields.cancelledReason) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.CANCELLED_REASON_IS_MISSING
      };
    }
    return {
      status: constant.GENERAL_STATUS.SUCCESS
    };
  }

  public static validateCancelMeeting(ssoUid: string, meeting: Meeting, fields: Record<string, any>): any {
    if (![meeting.responderSsoUid, meeting.requesterSsoUid].includes(ssoUid)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.MEETING_RELATIONSHIP_WRONG.replace('{ssoUid}', ssoUid)
      };
    }

    if (![MeetingStatus.PENDING, MeetingStatus.ACCEPTED, MeetingStatus.RELEASED].includes(meeting.status)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.MEETING_STATUS_IS_NOT_PENDING_ACCEPTED
      };
    }

    if (!fields.cancelledReason) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.CANCELLED_REASON_IS_MISSING
      };
    }

    if (!meeting.isEditable) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.MEETING_CANNOT_BE_CANCELLED
      };
    }

    return {
      status: constant.GENERAL_STATUS.SUCCESS
    };
  }

  public static validateRescheduleMeeting(
    ssoUid: string,
    meeting: Meeting,
    collidedMeetings: Meeting[],
    combinedUnavailableTimeslots: UnavailableTimeslot[],
    fields: Record<string, any>
  ): any {
    if (![meeting.responderSsoUid, meeting.requesterSsoUid].includes(ssoUid)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.MEETING_RELATIONSHIP_WRONG.replace('{ssoUid}', ssoUid)
      };
    }

    if (![MeetingStatus.PENDING, MeetingStatus.ACCEPTED, MeetingStatus.RELEASED].includes(meeting.status)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.MEETING_STATUS_IS_NOT_PENDING_ACCEPTED
      };
    }

    if (!meeting.isEditable) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.MEETING_CANNOT_BE_RESCHEDULE
      };
    }

    const allTimeslotDto: TimeslotDto[] = this.mergeTimeslotDto(collidedMeetings, combinedUnavailableTimeslots);

    return this.checkCollided(fields.startTime, fields.endTime, allTimeslotDto);
  }

  private static mergeTimeslotDto(...arg: any[]): TimeslotDto[] {
    const allTimeslotDto: TimeslotDto[] = [];

    arg.map((array:any[]) => array.forEach((object: { [others: string]: any, startTime: Date, endTime: Date }, index:number) => {
      allTimeslotDto.push({
        startTime: object.startTime,
        endTime: object.endTime,
      });
      if (object?.name) {
        allTimeslotDto[index].name = object?.name;
        allTimeslotDto[index].fairCode = object?.fairCode;
      }
    }));
    return allTimeslotDto;
  }

  private static checkCollided(startTime: Date, endTime: Date, timeslots: Array<TimeslotDto>): Record<string, any> {
    const collidedTimeslots = timeslots.filter((item: TimeslotDto) => {
      const isBetweenStartEnd = moment(startTime).isBetween(item.startTime, item.endTime) || moment(endTime).isBetween(item.startTime, item.endTime);
      const isSameStartOrEnd = moment(startTime).isSame(item.startTime) || moment(endTime).isSame(item.endTime);
      const isOverlapped = moment(startTime).isBefore(item.startTime) && moment(endTime).isAfter(item.endTime);

      return isBetweenStartEnd || isSameStartOrEnd || isOverlapped;
    });

    if (collidedTimeslots.length) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.COLLIDED_MEETING.replace('{fairName}', collidedTimeslots[0].fairCode ?? '')
      };
    }
    return {
      status: constant.GENERAL_STATUS.SUCCESS
    };
  }
}

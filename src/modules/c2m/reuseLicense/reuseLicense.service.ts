import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { constant } from '../../../config/constant';
import { SendbirdLicenseOptionalInterface, SendbirdLicenseMustInterface } from '../../../dto/sendbirdLicense.dto';
import { ZOOMLicenseMustInterface, ZOOMLicenseOptionalInterface } from '../../../dto/zoomLicense.dto';
import { Meeting } from '../../../entities/meeting.entity';
import { SendbirdLicense } from '../../../entities/sendbirdLicense.entity';
import { Logger } from '../../../core/utils/logger.service';
import { ZOOMLicense } from '../../../entities/zoomLicense.entity';

@Injectable()
export class ReuseLicenseService {
  constructor(
    @InjectRepository(SendbirdLicense)
    private sendbirdLicenseRepository: Repository<SendbirdLicense>,
    @InjectRepository(ZOOMLicense)
    private ZOOMLicenseRepository: Repository<ZOOMLicense>,
    @InjectRepository(Meeting)
    private meetingsRepository: Repository<Meeting>,
    private logger: Logger,
  ) { }

  public getAndActivateSendbirdQuota({ meetingId, userId }: SendbirdLicenseMustInterface & SendbirdLicenseOptionalInterface) {
    this.logger.log(`action: "checkSendbirdQuota", step: "start", meetingId: ${meetingId}, userId: ${userId}`);
    return this.meetingsRepository.findOne({ meetingId })
    .then(result => {
      this.logger.log(`action: "checkSendbirdQuota", step: "1", result: ${JSON.stringify(result)}`);
      if (!result) {
        return Promise.reject({
          status: constant.GENERAL_STATUS.FAIL,
          message: constant.CHATROOM.ERROR_MESSAGE.NO_MEETING_ID_FOUND,
        })
      }

      return this.sendbirdLicenseRepository.find({
      where: [
            { meetingId, userId },
            { status: 0 }
        ]
      })
    })
    .then(result => {
      this.logger.log(`action: "checkSendbirdQuota", step: "end", result: ${JSON.stringify(result)}`);
      if (!result?.length) {
        return Promise.reject({
          status: constant.GENERAL_STATUS.FAIL,
          message: constant.CHATROOM.ERROR_MESSAGE.NO_AVAILABLE_ROOM,
        })
      }

      let firstAvailableRecord: Record<string, any> | null = null;
      let recordBeingUsed: Record<string, any> | null = null;

      result.some(record => {
        if (firstAvailableRecord && recordBeingUsed) {
          return true;
        }
        if (!firstAvailableRecord && !record?.meetingId?.length && !record?.userId?.length && record?.status === 0) {
          firstAvailableRecord = record;
        }

        if (record?.meetingId === meetingId && record?.userId === userId && record?.status === 1) {
          recordBeingUsed = record;
        }

        return false;
      })

      return Promise.all([
        Promise.resolve(firstAvailableRecord),
        Promise.resolve(recordBeingUsed),
        !recordBeingUsed ? this.sendbirdLicenseRepository.update({ referenceKey: firstAvailableRecord!.referenceKey }, { meetingId, userId, status: 1, lastUpdatedAt: new Date()}) : null
      ])
    })
    .then(([firstAvailableRecord, recordBeingUsed, updateResult]: any): any => {
      let responseData: Record<string, any> | null = null;
      if (updateResult?.affected && updateResult?.affected !== 0) {
        responseData = firstAvailableRecord;
      } else {
        responseData = recordBeingUsed;
      }
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        data: responseData
      }
    })
    .catch(error => {
      this.logger.log(`action: "checkSendbirdQuota", step: "error", error: ${JSON.stringify(error)}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error)
      }
    })
  }

  public deactivateSendbirdLicenseRecord({ meetingId }: SendbirdLicenseMustInterface) {
    return this.sendbirdLicenseRepository.update({ meetingId }, { meetingId: undefined, userId: undefined, status: 0, lastUpdatedAt: new Date() })
      .then(result => {
        this.logger.log(JSON.stringify({ action: "deactivateSendbirdLicenseRecord - POST - /:meetingId/deactivateSendbirdLicenseRecord", section: "c2m - chatroom", step: "success", detail: result }));
        return Promise.resolve({
          status: constant.GENERAL_STATUS.SUCCESS,
          data: result
        })
      })
    .catch(error => {
      this.logger.log(JSON.stringify({ action: "deactivateSendbirdLicenseRecord - POST - /:meetingId/deactivateSendbirdLicenseRecord", section: "c2m - chatroom", step: "error", detail: error }));
      return Promise.reject({
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error)
      })
    })
  }

  // zoom
  public createZOOMLicenseRecord({ meetingId, accountEmail }: ZOOMLicenseMustInterface & ZOOMLicenseOptionalInterface) {
    return this.ZOOMLicenseRepository.find({ meetingId, accountEmail })
      .then(result => {
        if (result.length) {
          return Promise.reject({
            message: "Duplicate accountEmail"
          })
        }
        return this.ZOOMLicenseRepository.save({ meetingId, accountEmail, creationTime: new Date(), lastUpdatedAt: new Date() });
      })
      .then(result => {
        if (result.id) {
          return Promise.resolve({
            status: 200,
            result
          })
        }
        return Promise.reject();
      })
      .catch(error => {
        return Promise.reject({
          status: 400,
          message: error?.message ?? JSON.stringify(error)
        })
      })
  }

  public deleteZOOMLicenseRecordByMeetingId({ meetingId }: ZOOMLicenseMustInterface) {
    return this.ZOOMLicenseRepository.delete({ meetingId });
  }

  public getZOOMLicenseRecordByMeetingId({ meetingId }: ZOOMLicenseMustInterface) {
    return this.ZOOMLicenseRepository.find({ meetingId });
  }

  public updateZOOMEmailAccountStatus({ meetingId, accountEmail }: ZOOMLicenseMustInterface & ZOOMLicenseOptionalInterface) {
    return this.ZOOMLicenseRepository.update({ accountEmail }, { meetingId, lastUpdatedAt: new Date() });
  }

  public releaseZOOMLicense({ meetingId }: ZOOMLicenseMustInterface) {
    return this.ZOOMLicenseRepository.update({ meetingId }, { meetingId: undefined, lastUpdatedAt: new Date() });
  }

  public getFirstPendingLicense() {
    return this.ZOOMLicenseRepository.find({ meetingId: IsNull() })
      .then(result => {
        if (!result.length) {
          return {
            status: 400
          }
        }
        return {
          status: 200,
          data: result[0]
        }
      })
  }

}

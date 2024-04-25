import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ReuseLicenseService } from './reuseLicense.service';
import { SendbirdLicenseMustDto, SendbirdLicenseOptionalDto } from '../../../dto/sendbirdLicense.dto';
import { Logger } from '../../../core/utils/logger.service';
import { ZOOMLicenseMustDto, ZOOMLicenseOptionalDto } from '../../../dto/zoomLicense.dto';

@Controller('reuseLicense')
export class ReuseLicenseController {
  constructor(
    private logger: Logger,
    private reuseLicense: ReuseLicenseService
  ) {}

  // ------------------------------------------------ sendbird ------------------------------------------------
  @Post('/getAndActivateSendbirdQuota')
  public getAndActivateSendbirdQuota(@Body() body: SendbirdLicenseMustDto & SendbirdLicenseOptionalDto): Record<string, any> {
    const { meetingId, userId } = body;
    return this.reuseLicense.getAndActivateSendbirdQuota({ meetingId, userId });
  }

  @Get('/deactivateSendbirdLicenseRecord/:meetingId')
  public deactivateSendbirdLicenseRecord(@Param() param: SendbirdLicenseMustDto): Record<string, any> { 
    const { meetingId } = param;
    this.logger.log(JSON.stringify({ action: "deactivateSendbirdLicenseRecord - POST - /:meetingId/deactivateSendbirdLicenseRecord", section: "c2m - chatroom", step: "ready", detail: { param } }));
    return this.reuseLicense.deactivateSendbirdLicenseRecord({ meetingId })
      .then(result => {
        return result;
      })
  }
  // ------------------------------------------------ end of sendbird ------------------------------------------------

  // ------------------------------------------------ zoom ------------------------------------------------
  @Post('/createZOOMLicenseRecord/:meetingId')
  public createZOOMLicenseRecord(@Param() param: ZOOMLicenseMustDto, @Body() body: ZOOMLicenseOptionalDto): Record<string, any> {
    const { accountEmail } = body;
    const { meetingId } = param;
    this.logger.log(JSON.stringify({action: "createZOOMLicenseRecord - POST - /:meetingId/createZOOMLicenseRecord", section: "c2m - chatroom", step: "ready", detail: {body, param}}));
    return this.reuseLicense.createZOOMLicenseRecord({ meetingId, accountEmail })
    .then(result => {
      this.logger.log(JSON.stringify({action: "createZOOMLicenseRecord - POST - /:meetingId/createZOOMLicenseRecord", section: "c2m - chatroom", step: "success", detail: result}));
      return result;
    })
    .catch(error => {
      this.logger.log(JSON.stringify({action: "createZOOMLicenseRecord - POST - /:meetingId/createZOOMLicenseRecord", section: "c2m - chatroom", step: "fail", detail: error}));
      return error;
    })
  }

  @Post('/deleteZOOMLicenseRecordByMeetingId/:meetingId')
  public deleteZOOMLicenseRecordByMeetingId(@Param() param: ZOOMLicenseMustDto): Record<string, any> {
    const { meetingId } = param;
    this.logger.log(JSON.stringify({action: "deleteZOOMLicenseRecordByMeetingId - POST - /:meetingId/deleteZOOMLicenseRecordByMeetingId", section: "c2m - chatroom", step: "ready", detail: param}));
    return this.reuseLicense.deleteZOOMLicenseRecordByMeetingId({ meetingId })
    .then(result => {
      this.logger.log(JSON.stringify({action: "deleteZOOMLicenseRecordByMeetingId - POST - /:meetingId/deleteZOOMLicenseRecordByMeetingId", section: "c2m - chatroom", step: "success", detail: result}));
      return result;
    })
    .catch(error => {
      this.logger.log(JSON.stringify({action: "deleteZOOMLicenseRecordByMeetingId - POST - /:meetingId/deleteZOOMLicenseRecordByMeetingId", section: "c2m - chatroom", step: "fail", detail: error}));
      return error;
    })
  }

  @Get('/getZOOMLicenseRecordByMeetingId/:meetingId')
  public getZOOMLicenseRecordByMeetingId(@Param() param: ZOOMLicenseMustDto): Record<string, any> {
    const { meetingId } = param;
    this.logger.log(JSON.stringify({action: "getZOOMLicenseRecordByMeetingId - POST - /:meetingId/getZOOMLicenseRecordByMeetingId", section: "c2m - chatroom", step: "ready", detail: {param}}));
    return this.reuseLicense.getZOOMLicenseRecordByMeetingId({ meetingId })
    .then(result => {
      this.logger.log(JSON.stringify({action: "getZOOMLicenseRecordByMeetingId - POST - /:meetingId/getZOOMLicenseRecordByMeetingId", section: "c2m - chatroom", step: "success", detail: result}));
      return result;
    })
    .catch(error => {
      this.logger.log(JSON.stringify({action: "getZOOMLicenseRecordByMeetingId - POST - /:meetingId/getZOOMLicenseRecordByMeetingId", section: "c2m - chatroom", step: "fail", detail: error}));
      return error;
    })
  }

  @Get('/getFirstPendingLicense')
  public getFirstPendingLicense(): Record<string, any> {
    return this.reuseLicense.getFirstPendingLicense()
    .then(result => {
      this.logger.log(JSON.stringify({action: "getFirstPendingLicense - POST - /getFirstPendingLicense", section: "c2m - chatroom", step: "success", detail: result}));
      return result;
    })
    .catch(error => {
      this.logger.log(JSON.stringify({action: "getFirstPendingLicense - POST - /getFirstPendingLicense", section: "c2m - chatroom", step: "fail", detail: error}));
      return error;
    })
  }

  @Post('/releaseZOOMLicense')
  public releaseZOOMLicense(@Body() body: ZOOMLicenseMustDto): Record<string, any> {
    const { meetingId } = body;
    return this.reuseLicense.releaseZOOMLicense({ meetingId })
    .then(result => {
      this.logger.log(JSON.stringify({action: "getFirstPendingLicense - POST - /getFirstPendingLicense", section: "c2m - chatroom", step: "success", detail: result}));
      return result;
    })
    .catch(error => {
      this.logger.log(JSON.stringify({action: "getFirstPendingLicense - POST - /getFirstPendingLicense", section: "c2m - chatroom", step: "fail", detail: error}));
      return error;
    })
  }

  @Post('/updateZOOMEmailAccountStatus')
  public updateZOOMEmailAccountStatus(@Body() body: ZOOMLicenseMustDto & ZOOMLicenseOptionalDto): Record<string, any> {
    const { meetingId, accountEmail } = body;
    this.logger.log(JSON.stringify({action: "updateZOOMEmailAccountStatus - POST - /updateZOOMEmailAccountStatus", section: "c2m - chatroom", step: "ready", detail: {body}}));
    return this.reuseLicense.updateZOOMEmailAccountStatus({ meetingId, accountEmail })
    .then(result => {
      this.logger.log(JSON.stringify({action: "updateZOOMEmailAccountStatus - POST - /updateZOOMEmailAccountStatus", section: "c2m - chatroom", step: "success", detail: result}));
      return result;
    })
    .catch(error => {
      this.logger.log(JSON.stringify({action: "updateZOOMEmailAccountStatus - POST - /updateZOOMEmailAccountStatus", section: "c2m - chatroom", step: "fail", detail: error}));
      return error;
    })
  }

  // ------------------------------------------------ end of zoom ------------------------------------------------
}

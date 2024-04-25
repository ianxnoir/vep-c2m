/* eslint-disable no-nested-ternary */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FifoSendMessageRequest, SqsService } from '@vep/sqs-package-registry';
import moment from 'moment';
import { getConnection, Repository } from 'typeorm';

import { v4 as uuid } from 'uuid';
import { constant } from '../../../config/constant';
import { Logger } from '../../../core/utils';
import { NotiSqsMessageBodyDto } from '../../../dto/NotiSqsMessageBodyMetaDataDto';
import { Meeting } from '../../../entities/meeting.entity';
import { NotificationEntity } from '../../../entities/notification.entity';
import { Recommendation } from '../../../entities/recommendation.entity';
import { BuyerService } from '../../api/buyer/buyer.service';
import { ApiExhibitorService } from '../../api/exhibitor/exhibitor.service';
import { ApiFairService } from '../../api/fair/fair.service';
import { NotificationAPIService } from '../../api/notificationAPI/notificationAPI.service';
import { SnsService } from '../../api/sns/sns.service';
import { BuyerNotificationEntity } from '../../content/buyer/entities/notification.entity';
import { Registration } from '../../content/buyer/entities/seminarRegistration';
import { ExhibitorNotificationEntity } from '../../content/exhibitor/entities/notification.entity';
import { MeetingRole } from '../meeting/meeting.type';
import { EmailStatus, NotificationTemplatesId, ChannelType, NotificationType, ReceiverRole } from './notification.type';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    private notificationEntity: Repository<NotificationEntity>,
    @InjectRepository(ExhibitorNotificationEntity, 'exhibitorDatabaseForWrite')
    private exhibitorNotificationEntity: Repository<ExhibitorNotificationEntity>,
    @InjectRepository(BuyerNotificationEntity, 'buyerDatabaseForWrite')
    private buyerNotificationEntity: Repository<BuyerNotificationEntity>,
    @InjectRepository(Recommendation)
    private recommendationRepository: Repository<Recommendation>,
    @InjectRepository(Registration, 'buyerDatabaseForWrite')
    private registrationEntity: Repository<Registration>,
    // private readonly connection: Connection,
    private exhibitorService: ApiExhibitorService,
    private fairService: ApiFairService,
    private sqsService: SqsService,
    private configService: ConfigService,
    // private httpService: HttpService,
    private buyerService: BuyerService,
    private logger: Logger,
    private notificationAPIService: NotificationAPIService,
    private apiExhibitorService: ApiExhibitorService,
    private snsService: SnsService,
  ) {}

  public getNotificationRecordByMeetingId(meetingId: number) {
    return this.notificationEntity.find({
      relations: ['meeting'],
      where: {
        meetingId
      }
     });
  }

  /*
  Create record - Organic Meeting
  */
  public createNotificationRecord({ meetingId, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent }: Record<string, any>) {
    return this.notificationEntity.save({meetingId, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent: JSON.stringify(notificationContent), creationTime: new Date(), lastUpdatedAt: new Date()});
  }

  /*
  Update content - Organic Meeting
  */
  public updateNotificationRecord({meetingId, notificationId, notificationType, receiverRole, notificationContent}: Record<string, any>) {
    return this.notificationEntity.update(
      {
        meetingId,
        id: notificationId
      },
      {
        notificationType,
        receiverRole,
        notificationContent: JSON.stringify(notificationContent),
        lastUpdatedAt: new Date()
      }
    );
  }

  /*
  Update SQS response - Organic Meeting
  */
  public updateNotificationSqsContent({meetingId, notificationId, sqsResponse}: Record<string, any>) {
    return this.notificationEntity.update(
      {
        meetingId,
        id: notificationId
      },
      {
        sqsResponse,
        lastUpdatedAt: new Date()
      }
    );
  }

  /*
  Update status - Organic Meeting
  */
  public updateNotificationStatus({meetingId, notificationId, status, retryCount}: Record<string, number>) {
    return this.notificationEntity.update(
      {
        meetingId,
        id: notificationId
      },
      {
        status,
        retryCount,
        lastUpdatedAt: new Date()
      }
    );
  }

  /*
  Update status - Organic Meeting
  */
  public updateNotificationErrorStatus({meetingId, notificationId, notificationContent, status, retryCount}: Record<string, any>) {
    return this.notificationEntity.update(
      {
        meetingId,
        id: notificationId
      },
      {
        notificationContent,
        status,
        retryCount,
        lastUpdatedAt: new Date()
      }
    );
  }


  /*
  Create record - Summary of Organic Meeting
  */
  public createSummaryNotificationRecord({meetingId, status, receiverRole, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, notificationContent}: Record<string, any>) {
    return this.notificationEntity.save({meetingId, status, receiverRole, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, notificationContent: JSON.stringify(notificationContent), creationTime: new Date(), lastUpdatedAt: new Date()});
  }

  /*
  Update SQS response and status - Summary of Organic Meeting
  */
  public updateSummaryNotificationStatus({id, meetingId, refUserId, refFairCode, refFiscalYear, status, sqsResponse}: Record<string, any>) {
    return this.notificationEntity.update(
      {
        id,
        meetingId,
        refUserId,
        refFairCode,
        refFiscalYear
      },
      {
        sqsResponse,
        status,
        lastUpdatedAt: new Date()
      }
    );
  }

  /*
  Update email status in vepFairDb.vepFairSeminarRegistration - Seminar
  */
  public updateSeminarEmailNotificationStatus({ updateArray }: Record<string, any>) {
    return this.registrationEntity.save(updateArray)
    .then((result: any) => {
      return {
        status: 200,
        data: result?.data ?? result
      };
    })
    .catch((rejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email', action: 'updateSeminarEmailNotificationStatus - error', detail: rejectedData, step: '1' }));
      return {
        status: 400,
        data: rejectedData
      };
    });
  }

  /*
  Update web noti status in vepFairDb.vepFairSeminarRegistration - Seminar
  */
  public updateSeminarWebNotificationStatus({ updateArray }: Record<string, any>) {
    return this.registrationEntity.save(updateArray)
    .then((result: any) => {
      return {
        status: 200,
        data: result?.data ?? result
      };
    })
    .catch((rejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email', action: 'updateSeminarWebNotificationStatus - error', detail: rejectedData, step: '1' }));
      return {
        status: 400,
        data: rejectedData
      };
    });
  }

  /*
  Create record - Exhibitor Kick Off
  */
  public createExhibitorNotificationRecord({meetingId, refUserId, refEoaFairId, templateId, channelType, notificationType, receiverRole, notificationContent}: Record<string, any>) {
    this.logger.log(JSON.stringify({ 
      action: 'create exhibitor kick off record', 
      section: 'handleKickOffExhibitorReminder', 
      step: '1', 
      detail: `
      host: ${process.env.EXHIBITOR_DB_HOST},
      port: ${process.env.EXHIBITOR_DB_PORT},
      username: ${process.env.EXHIBITOR_DB_USER},
      password: ${process.env.EXHIBITOR_DB_PASSWORD},
      database: ${process.env.EXHIBITOR_DB_DATABASE}
      ` 
    }));

    return this.exhibitorNotificationEntity.save({
      meetingId,
      refUserId,
      refEoaFairId,
      templateId,
      channelType,
      notificationType,
      receiverRole,
      notificationContent: JSON.stringify(notificationContent),
      status: 0,
      creationTime: new Date(),
      lastUpdatedAt: new Date(),
      retryCount: 0
    })
  }

  /*
  Create record - Buyer Kick Off
  */
  public createBuyerNotificationRecord({meetingId, status, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent}: Record<string, any>) {
    const d = new Date()
    let diff = d.getTimezoneOffset();
    this.logger.log(JSON.stringify({ action: 'new Date', section: 'debug for buyer kick off send out time - createBuyerNotificationRecord', step: '1', detail: `new Date: ${new Date()}` }));
    this.logger.log(JSON.stringify({ action: 'd', section: 'debug for buyer kick off send out time - createBuyerNotificationRecord', step: '2', detail: `d: ${d}` }));
    this.logger.log(JSON.stringify({ action: 'diff', section: 'debug for buyer kick off send out time - createBuyerNotificationRecord', step: '3', detail: `diff: ${diff}` }));
    return this.buyerNotificationEntity.save({
      meetingId,
      status,
      refUserId,
      refFairCode,
      refFiscalYear,
      templateId,
      channelType,
      notificationType,
      receiverRole,
      notificationContent: JSON.stringify(notificationContent),
      creationTime: new Date(),
      lastUpdatedAt: new Date(),
      retryCount: 0
    });
  }

  /*
  Create record - Seminar
  */
  public createSeminarNotificationRecord({ meetingId, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent }: Record<string, any>) {
    return this.notificationEntity.save({ meetingId, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent: JSON.stringify(notificationContent), creationTime: new Date(), lastUpdatedAt: new Date() })
  }

  /*
  Create record - Seminar Summary
  */
  public createSeminarSummaryNotificationRecord({tableId, meetingId, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent}: Record<string, any>) {
    return this.buyerNotificationEntity.save({
      meetingId, 
      status: 0,
      refUserId, 
      refFairCode, 
      refFiscalYear, 
      templateId, 
      channelType, 
      notificationType, 
      receiverRole, 
      notificationContent: JSON.stringify(notificationContent), 
      creationTime: new Date(), 
      lastUpdatedAt: new Date(),
      retryCount: 0
    })
    .then((result :any) => {
      console.log(result);
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        id: result.id
      }
    })
    .catch((error) => {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }
    });
  }

  /*
  Create record - BM List
  */
  public createNotificationRecordForBmList({meetingId, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent}: Record<string, any>) {
    return this.notificationEntity.save({
      meetingId,
      refUserId,
      refFairCode,
      refFiscalYear,
      templateId,
      channelType,
      notificationType,
      receiverRole,
      notificationContent: JSON.stringify(notificationContent),
      status: 0,
      creationTime: new Date(),
      lastUpdatedAt: new Date(),
      retryCount: 0
    });
  }

  public getTemplateContent({templateId, fairCode} :Record<string, any>): Promise<any> {
    return this.notificationAPIService.getTemplateContent({templateId, fairCode});
  }

  public getTemplateContentR2BVersion({ templateId } :Record<string, any>): Promise<any> {
    return this.notificationAPIService.getTemplateContentR2BVersion({ templateId });
  }

  public getMessageBodyForSns({ templateId, templateSource } :Record<string, any>): Promise<any> {
    return this.notificationAPIService.getMessageBodyForSns({ templateId, templateSource });
  }

  public getBuyerProfile({ssoUid} :Record<string, any>): Promise<any> {
    return this.fairService.getFairParticipantRegistrations([ssoUid]);
  }

  public getExhibitorProfile({companyCcdid} :Record<string, any>): Promise<any> {
    return this.exhibitorService.getExhibitorProfilesByCCDID([companyCcdid]);
  }

  public getBuyerTimezoneAndPreferredLanguage({fairCode, ssoUid, email} :Record<string, any>): Promise<any> {
    return this.buyerService.getTimezoneAndPreferredLang(fairCode, ssoUid, email);
  }

  /*
  Send email to SQS - Organic Meeting
  */
  public async sendEmail({subject, receiver, emailContent, sqsQuery, meetingData, templateId, channelType, notificationType, receiverRole, notificationRecord, retryCount, userProfile, newCounterProfile} :Record<string, any>): Promise<any> {
    try {
      // const office_code = 'NY';
      let query;
      let officeEmail = '';
      if (templateId === NotificationTemplatesId.RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR ||
          templateId === NotificationTemplatesId.CANCEL_BM_MEETING_BY_BUYER_OR_EXHIBITOR ||
          templateId === NotificationTemplatesId.CANCEL_BM_MEETING_BY_BM_TO_RESPONDER ||
          templateId === NotificationTemplatesId.CANCEL_BM_MEETING_BY_BM_TO_REQUESTER ||
          templateId === NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_BUYER ||
          templateId === NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR ||
          templateId === NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_BUYER ||
          templateId === NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR) {
              query = `SELECT * FROM vep_content.vep_council_global_office where office_code = '${userProfile.overseasBranchOffice}'`;

              const connection = await getConnection('contentDatabase');
              const slaveRunner = connection.createQueryRunner('slave');
              let relatedOfficeInfo: any;
              try {
                relatedOfficeInfo = await connection.query(query, undefined, slaveRunner);
              } catch (error) {
                console.log("Error in sendEmail api", error);
              } finally {
                slaveRunner.release();
              }
              officeEmail = relatedOfficeInfo?.[0]?.email || '';
      }

      const content = {
        QueueUrl: sqsQuery,
        MessageBody: JSON.stringify({
          from: { name: 'HKTDC Exhibitions', address: this.configService.get<string>('notification.from') },
          to: receiver,
          cc: officeEmail === '' ? '' : [officeEmail],
          html: emailContent,
          subject,
          msgInfo: {
            "user-activity": {
              registrationNo: userProfile.registrationNo,
              notificationType,
              receiverRole,
              meetingData,
              templateId,
              channelType
            }
          }
        }),
          MessageDeduplicationId: uuid(),
          MessageGroupId: uuid(),
      };
        this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
        return this.sendSQSNotification({ content, meetingData, notificationRecord, channelType, notificationType, receiverRole, retryCount });
    } catch (error) {
      this.logger.log(JSON.stringify({ 
        section: 'sendEmail', 
        action: 'Notification - sendEmail', 
        step: 'catch error', 
        detail: 
        { 
          input: subject, receiver, emailContent, sqsQuery, meetingData, templateId, channelType, notificationType, receiverRole, notificationRecord, retryCount, userProfile, 
          error: JSON.stringify(error) 
        } 
      }));
      return {
        status: 400,
        message: JSON.stringify(error),
      }
    }
    
  }

  /*
  Send web notification to SQS - Organic Meeting
  */
  public async sendWebNotification({ notificationContent, meetingData, sqsQuery, notificationRecord, channelType, notificationType, receiverRole, userProfile, retryCount, templateId, receiverFairCode}: Record<string, any>): Promise<any> {
    try {
      const firstName = userProfile.userId === meetingData.requesterSsoUid ? meetingData.requesterFirstName : meetingData.responderFirstName;
      const lastName = userProfile.userId === meetingData.requesterSsoUid ? meetingData.requesterLastName : meetingData.responderLastName;
      let fairCode;

      if( receiverFairCode === undefined || receiverFairCode === null) {
        if (notificationType === NotificationType.CANCEL_BM_MEETING_BY_BM || notificationType === NotificationType.CANCEL_C2M_MEETING_BY_BM || (notificationType === NotificationType.CANCEL_BM_MEETING_BY_BUYER_OR_EXHIBITOR && meetingData.requesterRole === ReceiverRole.EXHIBITOR)) {
          fairCode = userProfile.userId === meetingData.requesterSsoUid ? meetingData.responderFairCode : meetingData.fairCode;
        } else {
          fairCode = userProfile.userId === meetingData.requesterSsoUid ? meetingData.fairCode : meetingData.responderFairCode;
        }
      }

      const role = userProfile.userId === meetingData.requesterSsoUid ? meetingData.requesterRole : meetingData.responderRole;

      let meetingStatus = '';
      if (meetingData.status === 0) {
        meetingStatus = 'PENDING';
      } else if (meetingData.status === 1) {
        meetingStatus = 'UPCOMING';
      } else if (meetingData.status === 2 || meetingData.status === 3 || meetingData.status === 4) {
        meetingStatus = 'CANCEL';
      }
      const content = {
        QueueUrl: sqsQuery,
        MessageBody: JSON.stringify({
          searchUserInfo: {
            emailAddress: userProfile.emailId,
            firstName: firstName,
            lastName: lastName,
            ssoUid: userProfile.userId,
          },
          msgInfo: {
            sbMessageProperty: {
              message: notificationContent,
            },
            msgMetadata: {
              fairCode: receiverFairCode ?? fairCode,
              toRole: role, // newly added
              year: new Date().getFullYear(), // same as above "year" handling
              urlLink: this.generateC2MLink(meetingStatus, receiverFairCode ?? fairCode, userProfile.preferredLanguage),
              notificationType: 'meeting',
            },
            "user-activity": {
              registrationNo: userProfile.registrationNo,
              notificationType,
              receiverRole,
              meetingData,
              templateId
            }
          }
        }),
        MessageDeduplicationId: `${uuid()}_${userProfile.userId}`,
        MessageGroupId: `${uuid()}_${meetingData.id}`,
      };
      this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
      return this.sendSQSNotification({ content, meetingData, notificationRecord, channelType, notificationType, receiverRole, retryCount });
    } catch (error) {
      this.logger.log(JSON.stringify({ 
        section: 'sendWebNotification', 
        action: 'Notification - sendWebNotification', 
        step: 'catch error', 
        detail: 
        { 
          input: notificationContent, meetingData, sqsQuery, notificationRecord, channelType, notificationType, receiverRole, userProfile, retryCount, 
          error: JSON.stringify(error) 
        } 
      }));
      return {
        status: 400,
        message: JSON.stringify(error),
      }
    }
  }

  /*
  Update the notification content, SQS response and status in the table - Organic Meeting
  */
  private sendSQSNotification({ content, meetingData, notificationRecord, channelType, notificationType, receiverRole, retryCount }: Record<string, any>) {
    this.updateNotificationRecord({ meetingId: meetingData.id, notificationId: notificationRecord.id, receiverRole, notificationContent: content })
    .then((result) => {
      this.logger.log(JSON.stringify({ section: 'Email', action: 'update Notification Record - email', detail: { result }, step: '1' }));
      return Promise.all([
        this.sqsService.sendSqsMessage(<FifoSendMessageRequest>content),
        Promise.resolve(result)
      ]);
    })
    .then(async ([sqsResult, notificationResult]): Promise<any> => {
      this.logger.log(JSON.stringify({ section: 'Email', action: 'sendSqsMessage result - email', detail: { sqsResult, notificationResult }, step: '2' }));
      await this.updateNotificationSqsContent({meetingId: meetingData.id, notificationId: notificationRecord.id, sqsResponse: JSON.stringify(sqsResult)});
      if (!sqsResult) {
        return Promise.reject({
          notificationResult,
          message: 'No SQS result'
        });
      }

      if (!notificationResult) {
        return Promise.reject({
          notificationResult: null,
          message: 'Cant update notification record'
        });
      }

      return this.updateNotificationStatus({ meetingId: meetingData.id, notificationId: notificationRecord.id, status: EmailStatus.SENT, retryCount });
    })
    .then(result => {
      return {
        status: 200,
        data: result?.data ?? result
      };
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email', action: 'sendSqsMessage result error - email', detail: RejectedData, step: '3' }));

      return this.updateNotificationStatus({ meetingId: meetingData.id, notificationId: notificationRecord.id, status: EmailStatus.SEND_TO_SNS_ERROR, retryCount });
    });
  }

  /*
  Send email to SQS - Summary of Organic Meeting
  */
  public async sendEmailForSummary({subject, receiver, emailContent, sqsQuery, templateId, channelType, notificationType, receiverRole, userId, fairCode, fiscalYear, registrationNo, meetingData} :Record<string, any>): Promise<any> {
    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        from: {name: "HKTDC Exhibitions", address: this.configService.get<string>('notification.from')},
        to: receiver,
        // cc: templateId === NotificationTemplatesId.RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR ? ['ext-esdivchng@hktdc.org'] : [],
        html: emailContent,
        subject,
        msgInfo: {
          "user-activity": {
            registrationNo,
            notificationType,
            receiverRole,
            meetingData,
            templateId,
            channelType
          }
        }
      }),
      MessageDeduplicationId: uuid(),
      MessageGroupId: uuid(),
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForSummary({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content})
  }

  /*
  Create record and Update the SQS response and status in the table - Organic Meeting
  */
  private sendSQSNotificationForSummary({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content}: Record<string, any>) {
    let recordId = 0;
    return this.createSummaryNotificationRecord({ meetingId: 0, status: 0 , receiverRole, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, templateId, channelType, notificationType, notificationContent: JSON.stringify(content) })
    .then(result => {
      recordId = result.id;
      return this.sqsService.sendSqsMessage(<FifoSendMessageRequest>content);
    }).then((sqsResult): any => {
      if (!sqsResult) {
        return Promise.reject({
          message: 'No SQS result'
        });
      }

      const date = new Date()
      this.logger.log(JSON.stringify({ action: 'trigger endpoint end', section: 'Notification - cron job dailyMeetingReminder', step: '1', detail: `time of triggering end ${date}. userId: ${userId}, fairCode: ${fairCode}, fiscalYear: ${fiscalYear}, receiverRole: ${receiverRole}` }));

      return this.updateSummaryNotificationStatus({ id:recordId, meetingId: 0, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, status: EmailStatus.SENT , sqsResponse: JSON.stringify(sqsResult) });
    })
    .then(result => {
      return {
        status: 200,
        data: result?.data ?? result
      };
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email', action: 'sendSqsMessage result error - email', detail: RejectedData, step: '3' }));
    })
  }

  /*
  Send email to SQS - Buyer/Exhibitor Kick Off
  */
  public async sendEmailForKickOff({subject, receiver, emailContent, sqsQuery, templateId, channelType, notificationType, receiverRole, userData, userId, fairCode, fiscalYear} :Record<string, any>): Promise<any> {
    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        from: {name: "HKTDC Exhibitions", address: this.configService.get<string>('notification.from')},
        to: receiver,
        // cc: templateId === NotificationTemplatesId.RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR ? ['ext-esdivchng@hktdc.org'] : [],
        html: emailContent,
        subject,
        msgInfo: {
          "user-activity": {
            registrationNo: userData.registrationNo,
            notificationType,
            receiverRole,
            templateId,
            channelType
          }
        }
      }),
      MessageDeduplicationId: uuid(),
      MessageGroupId: uuid(),
    };
    // this.logger.log(JSON.stringify({ section: 'Email', action: 'sendSqsMessage content - email', detail: content, step: '1' }));
    if (receiverRole === ReceiverRole.EXHIBITOR) {
      this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
      return this.sendSQSNotificationForExhibitorKickOff({receiverRole, userId, fairCode, fiscalYear, userData, templateId, channelType, notificationType, content })
    } else {
      this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
      return this.sendSQSNotificationForBuyerKickOff({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content})
    }

  }

  /*
  Send web notification to SQS - Buyer/Exhibitor Kick Off
  */
  public async sendWebNotificationForKickOFF({notificationContent, receiver, userData, userId, userPreferredLanguage, sqsQuery, templateId, channelType, notificationType, receiverRole, fairCode, fiscalYear}: Record<string, any>): Promise<any> {
    const firstName = userData.firstName;
    const lastName = userData.lastName;

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        searchUserInfo: {
          emailAddress: receiver,
          firstName: firstName,
          lastName: lastName,
          ssoUid: userId,
        },
        msgInfo: {
          sbMessageProperty: {
            message: notificationContent,
          },
          msgMetadata: {
            fairCode,
            toRole: receiverRole, // newly added
            year: new Date().getFullYear(), // same as above "year" handling
            urlLink: `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${userPreferredLanguage}/c2m-meeting/dashboard`,
            notificationType: 'fair',
          },
          "user-activity": {
            registrationNo: userData.registrationNo,
            notificationType,
            receiverRole,
            templateId,
            channelType
          }
        }
       }),
      MessageDeduplicationId: `${uuid()}_${userId}`,
      MessageGroupId: `${uuid()}`,
    };

    if (receiverRole === ReceiverRole.EXHIBITOR) {
      this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
      return this.sendSQSNotificationForExhibitorKickOff({receiverRole, userId, fairCode, fiscalYear, userData, templateId, channelType, notificationType, content })
    } else {
      this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
      return this.sendSQSNotificationForBuyerKickOff({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content})
    }
  }

  /*
  Send email to SQS - Seminar
  */
  public async sendEmailForSeminar({subject, receiver, emailContent, sqsQuery, templateId, channelType, notificationType, userData, receiverRole, userId, fairCode, fiscalYear, userWithSeminarData} :Record<string, any>): Promise<any> {
    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        from: {name: "HKTDC Exhibitions", address: this.configService.get<string>('notification.from')},
        to: receiver,
        html: emailContent,
        subject,
      }),
      MessageDeduplicationId: uuid(),
      MessageGroupId: uuid(),
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForSeminar({ userData, receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userWithSeminarData })
  }

  /*
  Send web notification to SQS - Seminar
  */
  public async sendWebNotificationForSeminar({notificationContent, receiver, userData, userId, userPreferredLanguage, sqsQuery, templateId, channelType, notificationType, receiverRole, fairCode, fiscalYear, userWithSeminarData}: Record<string, any>): Promise<any> {
    const firstName = userData?.firstName;
    const lastName = userData?.lastName;

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        searchUserInfo: {
          emailAddress: receiver,
          firstName: firstName,
          lastName: lastName,
          ssoUid: userId,
        },
        msgInfo: {
          sbMessageProperty: {
            message: notificationContent,
          },
          msgMetadata: {
            fairCode,
            toRole: receiverRole, // newly added
            year: new Date().getFullYear(), // same as above "year" handling
            urlLink: `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${userPreferredLanguage}/c2m-meeting/seminar?tab=upcoming`,
            notificationType: 'fair',
          },
        }
       }),
      MessageDeduplicationId: `${uuid()}_${userId}`,
      MessageGroupId: `${uuid()}`,
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForSeminar({ userData, receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userWithSeminarData })
  }

  /*
  Send email to SQS - Seminar Summary
  */
  public async sendEmailForSeminarSummary({ subject, receiver, emailContent, sqsQuery, templateId, channelType, notificationType, userData, receiverRole, userId, fairCode, fiscalYear, seminarsDataByTargetUser } :Record<string, any>): Promise<any> {
    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        from: {name: "HKTDC Exhibitions", address: this.configService.get<string>('notification.from')},
        to: receiver,
        html: emailContent,
        subject,
      }),
      MessageDeduplicationId: uuid(),
      MessageGroupId: uuid(),
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForSeminarSummary({ userData, receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, seminarsDataByTargetUser })
  }

  /*
  Send web notification to SQS - Seminar Summary
  */
  public async sendWebNotificationForSeminarSummary({ notificationContent, receiver, userData, userId, userPreferredLanguage, sqsQuery, templateId, channelType, notificationType, receiverRole, fairCode, fiscalYear, seminarsDataByTargetUser }: Record<string, any>): Promise<any> {
    const firstName = userData?.firstName;
    const lastName = userData?.lastName;

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        searchUserInfo: {
          emailAddress: receiver,
          firstName: firstName,
          lastName: lastName,
          ssoUid: userId,
        },
        msgInfo: {
          sbMessageProperty: {
            message: notificationContent,
          },
          msgMetadata: {
            fairCode,
            toRole: receiverRole, // newly added
            year: new Date().getFullYear(), // same as above "year" handling
            urlLink: `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${userPreferredLanguage}/c2m-meeting/seminar?tab=upcoming`,
            notificationType: 'fair',
          },
        }
       }),
      MessageDeduplicationId: `${uuid()}_${userId}`,
      MessageGroupId: `${uuid()}`,
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForSeminarSummary({ userData, receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, seminarsDataByTargetUser })
  }

  /*
  Send email to SQS - Seminar Retry
  */
  public async sendEmailForSeminarRetry({subject, receiver, emailContent, sqsQuery, templateId, channelType, notificationType, receiverRole, userData, userId, fairCode, fiscalYear, notiTableId, seminarTableId, retryCount} :Record<string, any>): Promise<any> {

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        from: {name: "HKTDC Exhibitions", address: this.configService.get<string>('notification.from')},
        to: receiver,
        html: emailContent,
        subject,
      }),
      MessageDeduplicationId: uuid(),
      MessageGroupId: uuid(),
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForSeminarRetry({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData, notiTableId, seminarTableId, retryCount})
  }

  /*
  Send web notification to SQS - Seminar Rerty
  */
  public async sendWebNotificationForSeminarRetry({notificationContent, receiver, userData, userId, userPreferredLanguage, sqsQuery, templateId, channelType, notificationType, receiverRole, fairCode, fiscalYear, notiTableId, seminarTableId, retryCount}: Record<string, any>): Promise<any> {
    const firstName = userData.firstName;
    const lastName = userData.lastName;

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        searchUserInfo: {
          emailAddress: receiver,
          firstName: firstName,
          lastName: lastName,
          ssoUid: userId,
        },
        msgInfo: {
          sbMessageProperty: {
            message: notificationContent,
          },
          msgMetadata: {
            fairCode,
            toRole: receiverRole, // newly added
            year: new Date().getFullYear(), // same as above "year" handling
            urlLink: `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${userPreferredLanguage}/c2m-meeting/recommendation?tab=byTDC`,
            notificationType: 'fair',
          },
        }
       }),
      MessageDeduplicationId: `${uuid()}_${userId}`,
      MessageGroupId: `${uuid()}`,
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForSeminarRetry({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData, notiTableId, seminarTableId, retryCount})
  }

  /*
  Update the SQS response, status and retryCount in the table - Seminar Retry
  */
  private sendSQSNotificationForSeminarRetry({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData, notiTableId, seminarTableId, retryCount}: Record<string, any>) {
    // update the retryCount by noti tabel ID
    let tableId = 0;
    const updatedRecords: Promise<any>[] = [];
    const updatedSQSRecords: Promise<any>[] = [];
    notiTableId.forEach((notiId: any) => {
      updatedRecords.push(this.notificationEntity.save({ id: notiId, notificationContent: JSON.stringify(content), retryCount, lastUpdatedAt: new Date() }))
    });
    return Promise.all(updatedRecords)
    .then(result => {
      return Promise.all([result, this.sqsService.sendSqsMessage(<FifoSendMessageRequest>content)]);
    })
    .then(([result, sqsResult]: any )=> {
      if (!sqsResult) {
         this.logger.log(JSON.stringify({ section: `sendSQSNotificationForSeminarRetry_${notificationType}_${channelType}`, action: 'sendSqsMessage result - notification', detail: { sqsResult }, step: 'error' }));
        return Promise.reject({
          message: 'No SQS result'
        });
      }

      result.forEach((record: any) => {
        updatedSQSRecords.push(this.notificationEntity.save({ id: record.id, status: EmailStatus.SENT, sqsResponse: JSON.stringify(sqsResult), lastUpdatedAt: new Date() }))
      });
      return Promise.all(updatedSQSRecords)
    })
    .then(result => {
      const tableIdArray: any[] = [];
      seminarTableId.forEach((seminarId: any) => {
        tableIdArray.push(seminarId);
      });
      // console.log(tableIdArray);

      return {
        status: 200,
        sqsData: result,
        channelType,
        tableId: tableIdArray
      };
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email - Seminar', action: `sendSqsMessage result error - email, Message: ${RejectedData}`, step: '2' }));
      return {
        status: 400,
        message: `sendSqsMessage result error - email, Message: ${RejectedData}`,
        tableId
      };
    });
  }

  /*
  Send email to SQS - Seminar Summary Retry
  */
  public async sendEmailForSeminarSummaryRetry({subject, receiver, emailContent, sqsQuery, templateId, channelType, notificationType, receiverRole, userData, userId, fairCode, fiscalYear, notiTableId, retryCount} :Record<string, any>): Promise<any> {

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        from: {name: "HKTDC Exhibitions", address: this.configService.get<string>('notification.from')},
        to: receiver,
        html: emailContent,
        subject,
      }),
      MessageDeduplicationId: uuid(),
      MessageGroupId: uuid(),
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForSeminarSummaryRetry({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData, notiTableId, retryCount})
  }

  /*
  Send web notification to SQS - Seminar Summary Retry
  */
  public async sendWebNotificationForSeminarSummaryRetry({notificationContent, receiver, userData, userId, userPreferredLanguage, sqsQuery, templateId, channelType, notificationType, receiverRole, fairCode, fiscalYear, notiTableId, retryCount}: Record<string, any>): Promise<any> {
    const firstName = userData.firstName;
    const lastName = userData.lastName;

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        searchUserInfo: {
          emailAddress: receiver,
          firstName: firstName,
          lastName: lastName,
          ssoUid: userId,
        },
        msgInfo: {
          sbMessageProperty: {
            message: notificationContent,
          },
          msgMetadata: {
            fairCode,
            toRole: receiverRole, // newly added
            year: new Date().getFullYear(), // same as above "year" handling
            urlLink: `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${userPreferredLanguage}/c2m-meeting/recommendation?tab=byTDC`,
            notificationType: 'fair',
          },
        }
       }),
      MessageDeduplicationId: `${uuid()}_${userId}`,
      MessageGroupId: `${uuid()}`,
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForSeminarSummaryRetry({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData, notiTableId, retryCount})
  }

  /*  
  Update the SQS response, status and retryCount in the table - Seminar Retry
  */
  private sendSQSNotificationForSeminarSummaryRetry({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData, notiTableId, retryCount}: Record<string, any>) {
    // update the retryCount by noti tabel ID
    let tableId = 0;
    const updatedRecords: Promise<any>[] = [];
    const updatedSQSRecords: Promise<any>[] = [];
    notiTableId.forEach((notiId: any) => {
      updatedRecords.push(this.notificationEntity.save({ id: notiId, notificationContent: JSON.stringify(content), retryCount, lastUpdatedAt: new Date() }))
    });
    return Promise.all(updatedRecords)
    .then(result => {
      return Promise.all([result, this.sqsService.sendSqsMessage(<FifoSendMessageRequest>content)]);
    })
    .then(([result, sqsResult]: any )=> {
      if (!sqsResult) {
         this.logger.log(JSON.stringify({ section: `sendSQSNotificationForSeminarSummaryRetry_${notificationType}_${channelType}`, action: 'sendSqsMessage result - notification', detail: { sqsResult }, step: 'error' }));
        return Promise.reject({
          message: 'No SQS result'
        });
      }

      result.forEach((record: any) => {
        updatedSQSRecords.push(this.notificationEntity.save({ id: record.id, status: EmailStatus.SENT, sqsResponse: JSON.stringify(sqsResult), lastUpdatedAt: new Date() }))
      });
      return result
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email - Seminar', action: `sendSqsMessage result error - email, Message: ${RejectedData}`, step: '2' }));
      return {
        status: 400,
        message: `sendSqsMessage result error - email, Message: ${RejectedData}`,
        tableId
      };
    });
  }

  /*
  Send email to SQS - BM List
  */
  public async sendEmailForBmList({subject, receiver, emailContent, sqsQuery, templateId, channelType, notificationType, receiverRole, userData, userDetailData, userId, fairCode, fiscalYear} :Record<string, any>): Promise<any> {
    let officeEmail = '';
    let bmSpecialistEmail = '';
    if (templateId === NotificationTemplatesId.NEW_BM_LIST ||
        templateId === NotificationTemplatesId.UPDATED_BM_LIST ||
        templateId === NotificationTemplatesId.NO_RESPONSE_REMINDER) {
        const query = `SELECT * FROM vep_content.vep_council_global_office where office_code = '${userDetailData?.overseasBranchOffice}'`;

        const connection = await getConnection('contentDatabase');
        const slaveRunner = connection.createQueryRunner('slave');
        let relatedOfficeInfo: any;
        try {
          relatedOfficeInfo = await connection.query(query, undefined, slaveRunner);
        } catch (error) {
          console.log("Error in sendEmailForBmList api", error);
        } finally {
          slaveRunner.release();
        }

        officeEmail = relatedOfficeInfo?.[0]?.email || '';
    }

    if (templateId === NotificationTemplatesId.NEW_BM_LIST || templateId === NotificationTemplatesId.UPDATED_BM_LIST) {
      bmSpecialistEmail = userData?.lastUpdatedBy || '';
    }

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        from: {name: "HKTDC Exhibitions", address: this.configService.get<string>('notification.from')},
        to: receiver,
        cc: [officeEmail, bmSpecialistEmail],
        html: emailContent,
        subject,
      }),
      MessageDeduplicationId: uuid(),
      MessageGroupId: uuid(),
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForBmList({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData})
  }

  /*
  Send web notification to SQS - BM List
  */
  public async sendWebNotificationForBmList({notificationContent, receiver, userData, userDetailData, userId, userPreferredLanguage, sqsQuery, templateId, channelType, notificationType, receiverRole, fairCode, fiscalYear}: Record<string, any>): Promise<any> {
    const firstName = userDetailData.firstName;
    const lastName = userDetailData.lastName;

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        searchUserInfo: {
          emailAddress: receiver,
          firstName: firstName,
          lastName: lastName,
          ssoUid: userId,
        },
        msgInfo: {
          sbMessageProperty: {
            message: notificationContent,
          },
          msgMetadata: {
            fairCode,
            toRole: receiverRole, // newly added
            year: new Date().getFullYear(), // same as above "year" handling
            urlLink: `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${userPreferredLanguage}/c2m-meeting/recommendation?tab=byTDC`,
            notificationType: 'fair',
          },
        }
       }),
      MessageDeduplicationId: `${uuid()}_${userId}`,
      MessageGroupId: `${uuid()}`,
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForBmList({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData})
  }

  /*
  Send email to SQS - BM List Retry
  */
  public async sendEmailForBmListRetry({subject, receiver, emailContent, sqsQuery, templateId, channelType, notificationType, receiverRole, userData, userDetailData, userId, fairCode, fiscalYear, retryCount} :Record<string, any>): Promise<any> {
    let officeEmail = '';
    let bmSpecialistEmail = '';
    if (templateId === NotificationTemplatesId.NEW_BM_LIST ||
        templateId === NotificationTemplatesId.UPDATED_BM_LIST ||
        templateId === NotificationTemplatesId.NO_RESPONSE_REMINDER) {
        const query = `SELECT * FROM vep_content.vep_council_global_office where office_code = '${userDetailData?.overseasBranchOffice}'`;

        const connection = await getConnection('contentDatabase');
        const slaveRunner = connection.createQueryRunner('slave');
        let relatedOfficeInfo: any;
        try {
          relatedOfficeInfo = await connection.query(query, undefined, slaveRunner);
        } catch (error) {
          console.log("Error in sendEmailForBmListRetry api", error);
        } finally {
          slaveRunner.release();
        }

        officeEmail = relatedOfficeInfo?.[0]?.email || '';
    }

    if (templateId === NotificationTemplatesId.NEW_BM_LIST || templateId === NotificationTemplatesId.UPDATED_BM_LIST) {
      bmSpecialistEmail = userData?.lastUpdatedBy || '';
    }

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        from: {name: "HKTDC Exhibitions", address: this.configService.get<string>('notification.from')},
        to: receiver,
        cc: [officeEmail, bmSpecialistEmail],
        html: emailContent,
        subject,
      }),
      MessageDeduplicationId: uuid(),
      MessageGroupId: uuid(),
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForBmListRetry({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData, retryCount})
  }

  /*
  Send web notification to SQS - BM List Rerty
  */
  public async sendWebNotificationForBmListRetry({notificationContent, receiver, userData, userDetailData, userId, userPreferredLanguage, sqsQuery, templateId, channelType, notificationType, receiverRole, fairCode, fiscalYear, retryCount}: Record<string, any>): Promise<any> {
    const firstName = userDetailData.firstName;
    const lastName = userDetailData.lastName;

    const content = {
      QueueUrl: sqsQuery,
      MessageBody: JSON.stringify({
        searchUserInfo: {
          emailAddress: receiver,
          firstName: firstName,
          lastName: lastName,
          ssoUid: userId,
        },
        msgInfo: {
          sbMessageProperty: {
            message: notificationContent,
          },
          msgMetadata: {
            fairCode,
            toRole: receiverRole, // newly added
            year: new Date().getFullYear(), // same as above "year" handling
            urlLink: `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${userPreferredLanguage}/c2m-meeting/recommendation?tab=byTDC`,
            notificationType: 'fair',
          },
        }
       }),
      MessageDeduplicationId: `${uuid()}_${userId}`,
      MessageGroupId: `${uuid()}`,
    };

    this.logger.log(JSON.stringify({ section: `Notification - ${notificationType} ${channelType}`, action: 'Send to SQS content', detail:`Send to SQS content: ${JSON.stringify(content)}`, step: '1' }));
    return this.sendSQSNotificationForBmListRetry({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData, retryCount})
  }

  /*
  Update the SQS response, status and retryCount in the table - BM List Retry
  */
  private sendSQSNotificationForBmListRetry({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData, retryCount}: Record<string, any>) {
    // update the retryCount by noti tabel ID
    return this.notificationEntity.save({ id: userData.notiRefId, retryCount, lastUpdatedAt: new Date() })
    .then(result => {
      return Promise.all([result, this.sqsService.sendSqsMessage(<FifoSendMessageRequest>content)]);
    })
    .then(([result, sqsResult]: any )=> {
      if (!sqsResult) {
         this.logger.log(JSON.stringify({ section: `sendSQSNotificationForBmList_${notificationType}_${channelType}`, action: 'sendSqsMessage result - notification', detail: { sqsResult }, step: 'error' }));
        return Promise.reject({
          message: 'No SQS result'
        });
      }
      return this.notificationEntity.save({ id: userData.notiRefId, meetingId: userData.notiRefBMId, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, status: EmailStatus.SENT, sqsResponse: JSON.stringify(sqsResult), lastUpdatedAt: new Date()});
    })
    .then(async result => {
      if (templateId === NotificationTemplatesId.NEW_BM_LIST || templateId === NotificationTemplatesId.UPDATED_BM_LIST) {
        if (channelType === ChannelType.EMAIL) {
          await this.recommendationRepository.update(
            {
              id: userData.notiRefBMId
            },
            {
              emailStatus: 1,
              lastUpdatedAt: new Date()
            }
          )
        } else if (channelType === ChannelType.WEB_NOTIFICATION) {
          await this.recommendationRepository.update(
            {
              id: userData.inotiRefBMId
            },
            {
              notificationStatus: 1,
              lastUpdatedAt: new Date()
            }
          )
        }
      }

      return {
        status: 200,
        content,
        data: result
      };
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: `sendSQSNotificationForBmList_${notificationType}_${channelType}`, action: 'sendSqsMessage result error', detail: `${RejectedData}`, step: 'error' }));
      return {
        status: 400,
        userId,
        fairCode,
        fiscalYear,
        content,
        data: JSON.stringify(RejectedData)
      };
    });
  }

  /*
  Create record and Update the SQS response and status in the table - Exhibitor Kick Off
  */
  private sendSQSNotificationForExhibitorKickOff({receiverRole, userId, fairCode, fiscalYear, userData, templateId, channelType, notificationType, content}: Record<string, any>) {
    // const targetChannelType = ChannelType.EMAIL;
    let exhibitorNotificationId = 0;
    return this.createExhibitorNotificationRecord({ meetingId: 0, refUserId: userId, receiverRole, refFairCode: fairCode, refFiscalYear: fiscalYear, templateId, channelType, notificationType, notificationContent: JSON.stringify(content)})
    .then(result => {
      this.logger.log(JSON.stringify({ 
        action: 'after creating record', 
        section: 'handleKickOffExhibitorReminder', 
        step: '6', 
        detail: `
        result: ${JSON.stringify(result)}
        ` 
      }));


      exhibitorNotificationId = result.id;
      return this.sqsService.sendSqsMessage(<FifoSendMessageRequest>content);
    })
    .then((sqsResult): any => {
      this.logger.log(JSON.stringify({ 
        action: 'sqs', 
        section: 'handleKickOffExhibitorReminder', 
        step: '7', 
        detail: `
        result: ${JSON.stringify(sqsResult)}
        ` 
      }));
      // this.logger.log(JSON.stringify({ section: 'Email', action: 'sendSqsMessage result - email', detail: { sqsResult, notificationResult }, step: '2' }));
      if (!sqsResult) {
        return Promise.reject({
          message: 'No SQS result'
        });
      }

      const date = new Date()
      this.logger.log(JSON.stringify({ action: 'trigger endpoint end', section: `Notification - cron job ${receiverRole}LoginReminder`, step: '1', detail: `time of triggering end ${date}. userId: ${userId}, fairCode: ${fairCode}, fiscalYear: ${fiscalYear}, receiverRole: ${receiverRole}` }));

      return this.exhibitorNotificationEntity.save({ id: exhibitorNotificationId, meetingId: 0, refUserId: userId, refEoaFairId: userData.eoaFairId, status: EmailStatus.SENT, sqsResponse: JSON.stringify(sqsResult), lastUpdatedAt: new Date()});
    })
    .then(result => {
      this.logger.log(JSON.stringify({ 
        action: 'final result', 
        section: 'handleKickOffExhibitorReminder', 
        step: '8', 
        detail: `
        result: ${JSON.stringify(result)}
        ` 
      }));
      return {
        status: 200,
        data: result?.data ?? result
      };
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email - Exhibitor Kick Off', action: 'handleKickOffExhibitorReminder', detail: `${RejectedData}`, step: 'error' }));
      return {
        status: 400,
        message: RejectedData ?? JSON.stringify(RejectedData),
      };
    })
  }

  /*
  Create record and Update the SQS response and status in the table - Buyer Kick Off
  */
  private sendSQSNotificationForBuyerKickOff({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content}: Record<string, any>) {
    // const targetChannelType = ChannelType.EMAIL;
    let buyerNotificationId = 0;
    const d = new Date()
    let diff = d.getTimezoneOffset();

    return this.createBuyerNotificationRecord({ meetingId: 0, status: 0, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, templateId, channelType, notificationType,  receiverRole, notificationContent: JSON.stringify(content)})
    .then(result => {
      buyerNotificationId = result.id;
      return this.sqsService.sendSqsMessage(<FifoSendMessageRequest>content);
    })
    .then((sqsResult): any => {
      // this.logger.log(JSON.stringify({ section: 'Email', action: 'sendSqsMessage result - email', detail: { sqsResult, notificationResult }, step: '2' }));
      if (!sqsResult) {
        return Promise.reject({
          message: 'No SQS result'
        });
      }
      this.logger.log(JSON.stringify({ action: 'new Date', section: 'debug for buyer kick off send out time - sendSQSNotificationForBuyerKickOff', step: '1', detail: `new Date: ${new Date()}` }));
      this.logger.log(JSON.stringify({ action: 'd', section: 'debug for buyer kick off send out time - sendSQSNotificationForBuyerKickOff', step: '2', detail: `d: ${d}` }));
      this.logger.log(JSON.stringify({ action: 'diff', section: 'debug for buyer kick off send out time - sendSQSNotificationForBuyerKickOff', step: '3', detail: `diff: ${diff}` }));
      return this.buyerNotificationEntity.save({ id: buyerNotificationId, meetingId: 0, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, status: EmailStatus.SENT, sqsResponse: JSON.stringify(sqsResult), lastUpdatedAt: new Date()});
    })
    .then(result => {
      return {
        status: 200,
        data: result?.data ?? result
      };
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email - Buyer Kick Off', action: 'sendSqsMessage result error - email', detail: `${RejectedData}`, step: '3' }));
      return {
        status: 400,
        message: RejectedData ?? JSON.stringify(RejectedData),
      };
    })
  }

  /*
  Create record and Update the SQS response and status in the table - Seminar
  */
  private sendSQSNotificationForSeminar({ userData, receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userWithSeminarData }: Record<string, any>) {
    let tableId = 0;

    const createdRecords: Promise<any>[] = [];
    const updateRecords: Promise<any>[] = [];
    userWithSeminarData.forEach((seminarData: any) => {
      createdRecords.push(this.createSeminarNotificationRecord({  meetingId: seminarData.id, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent: JSON.stringify(content) }))
    });
    return Promise.all(createdRecords)
    .then((createdRecords): any => {
      console.log(createdRecords);

      const failIds: any[] = [];
      createdRecords.forEach((record: any) => {
        if (record.status === constant.GENERAL_STATUS.FAIL) {
          failIds.push(record);
        }
      });

      // if there are any records created fail, don't send to SQS
      if (failIds.length > 0) {
        return Promise.reject(`There are at least one seminarId cannot be created the record in vepC2MNotification table. Details: ${JSON.stringify(failIds)}`);
      }

      return Promise.all([createdRecords, this.sqsService.sendSqsMessage(<FifoSendMessageRequest>content)]);
    })
    .then(([createdRecords, sqsResult]): any => {
      if (!sqsResult) {
        // this.logger.log(JSON.stringify({ section: 'Email', action: 'sendSqsMessage result - email', detail: { sqsResult, notificationResult }, step: '1' }));
        return Promise.reject({
          message: 'No SQS result'
        });
      }

      createdRecords.forEach((record: any) => {
        updateRecords.push(this.notificationEntity.save({ id: record.id, status: EmailStatus.SENT, sqsResponse: JSON.stringify(sqsResult), lastUpdatedAt: new Date() }))
      });
      return Promise.all(updateRecords)
    })
    .then(result => {
      const tableIdArray: any[] = [];
      userWithSeminarData.forEach((seminarData: any) => {
        tableIdArray.push(seminarData.id);
      });
      // console.log(tableIdArray);

      return {
        status: 200,
        sqsData: result?.data ?? result,
        channelType,
        tableId: tableIdArray
      };
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email - Seminar', action: `sendSqsMessage result error - email, Message: ${RejectedData}`, step: '2' }));
      return {
        status: 400,
        message: `sendSqsMessage result error - email, Message: ${RejectedData}`,
        tableId
      };
    });
  }

  /*
  Create record and Update the SQS response and status in the table - Seminar Summary
  */
  private sendSQSNotificationForSeminarSummary({ userData, receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, seminarsDataByTargetUser }: Record<string, any>) {
    const createdRecords: Promise<any>[] = [];
    if (templateId === NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER) {
      seminarsDataByTargetUser.forEach((seminarData: any) => {
        createdRecords.push(this.createSeminarSummaryNotificationRecord({ tableId: seminarData.tableId, meetingId: seminarData.seminarId, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent: JSON.stringify(content) }))
      });
    } else {
      createdRecords.push(this.createSeminarSummaryNotificationRecord({ meetingId: 0, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent: JSON.stringify(content) }))
    }


    // use return Promise.all() instead of return Promise.allSettled() -> all the seminar records of the user should be created successfully, then send noti
    return Promise.all(createdRecords)
    .then((createdRecords): any => {
      console.log(createdRecords);

      const failIds: any[] = [];
      createdRecords.forEach((record: any) => {
        if (record.status === constant.GENERAL_STATUS.FAIL) {
          failIds.push(record);
        }
      });

      // if there are any records created fail, don't send to SQS
      if (failIds.length > 0) {
        return Promise.reject(`There are at least one seminarId cannot be created the record in vepC2MNotification table. Details: ${JSON.stringify(failIds)}`);
      }

      return Promise.all([createdRecords, this.sqsService.sendSqsMessage(<FifoSendMessageRequest>content)]);
    })
    .then(([createdRecords, sqsResult]): any => {
      if (!sqsResult) {
        // this.logger.log(JSON.stringify({ section: 'Email', action: 'sendSqsMessage result - email', detail: { sqsResult, notificationResult }, step: '1' }));
        return Promise.reject({
          message: 'No SQS result'
        });
      }

      let resultArray: Promise<any>[] = [];
      createdRecords.forEach((record: any) => {
        resultArray.push(this.buyerNotificationEntity.save({ id: record.id, status: EmailStatus.SENT, sqsResponse: JSON.stringify(sqsResult), lastUpdatedAt: new Date() }))
      });
      return Promise.all(resultArray)
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email - Seminar', action: `sendSqsMessage result error - email, Message: ${RejectedData}`, step: '2' }));
      return {
        status: 400,
        message: `sendSqsMessage result error - email, Message: ${RejectedData}`,
      };
    });
  }

  /*
  Create record and Update the SQS response and status in the table - BM List
  */
  private sendSQSNotificationForBmList({receiverRole, userId, fairCode, fiscalYear, templateId, channelType, notificationType, content, userData}: Record<string, any>) {
    let notificationTableId = 0;

    this.logger.log(JSON.stringify({ section: 'Notification - BM List Summary', action: `sendSQSNotificationForBmList- before creating records. userId: ${userId}, fairCode: ${fairCode}, fiscalYear: ${fiscalYear}, templateId: ${templateId}, channelType: ${channelType}`, step: '2' }));
    return this.createNotificationRecordForBmList({ meetingId: userData.id, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent: JSON.stringify(content)})
    .then(result => {
      this.logger.log(JSON.stringify({ section: 'Notification - BM List Summary', action: `sendSQSNotificationForBmList- after creating records. userId: ${userId}, fairCode: ${fairCode}, fiscalYear: ${fiscalYear}, templateId: ${templateId}, channelType: ${channelType}`, step: '3' }));
      notificationTableId = result.id;
      return Promise.all([notificationTableId, this.sqsService.sendSqsMessage(<FifoSendMessageRequest>content)]);
    })
    .then(([notificationTableId, sqsResult]): any => {
      if (!sqsResult) {
         this.logger.log(JSON.stringify({ section: `sendSQSNotificationForBmList_${notificationType}_${channelType}`, action: 'sendSqsMessage result - notification', detail: { sqsResult }, step: 'error' }));
        return Promise.reject({
          message: 'No SQS result'
        });
      }

      const date = new Date()
      this.logger.log(JSON.stringify({ action: 'trigger endpoint end', section: 'Notification - cron job notEnoughInterestInBmListReminder', step: '1', detail: `time of triggering end ${date}. userId: ${userId}, fairCode: ${fairCode}, fiscalYear: ${fiscalYear}, receiverRole: ${receiverRole}` }));

      return this.notificationEntity.save({ id: notificationTableId, meetingId: userData.id, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, status: EmailStatus.SENT, sqsResponse: JSON.stringify(sqsResult), lastUpdatedAt: new Date() });
      // return this.notificationEntity.save({ id: notificationTableId, meetingId: userData.id, refUserId: userId, refFairCode: fairCode, refFiscalYear: fiscalYear, status: EmailStatus.SENT, sqsResponse: JSON.stringify(sqsResult)});
    })
    .then(async result => {
      if (templateId === NotificationTemplatesId.NEW_BM_LIST || templateId === NotificationTemplatesId.UPDATED_BM_LIST) {
        if (channelType === ChannelType.EMAIL) {
          await this.recommendationRepository.update(
            {
              id: userData.id
            },
            {
              emailStatus: 1,
              lastUpdatedAt: new Date()
            }
          )
        } else if (channelType === ChannelType.WEB_NOTIFICATION) {
          await this.recommendationRepository.update(
            {
              id: userData.id
            },
            {
              notificationStatus: 1,
              lastUpdatedAt: new Date()
            }
          )
        }
      }

      return {
        status: 200,
        content,
        data: result?.data ?? result
      };
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: `sendSQSNotificationForBmList_${notificationType}_${channelType}`, action: 'sendSqsMessage result error', detail: `${RejectedData}`, step: 'catch error' }));
      return {
        status: 400,
        userId,
        fairCode,
        fiscalYear,
        content,
        data: JSON.stringify(RejectedData)
      };
    });
  }

  public getSQSQuery = (meetingStartTime: Date) => {
    const today = moment().format('DD-MM-YYYY');

    if (today === moment(meetingStartTime).format('DD-MM-YYYY')) {
      return this.configService.get<string>('notification.webQueueUrlFast');
    }
    return this.configService.get<string>('notification.webQueueUrlStandard');
  }

  public getSQSQueryEmail = (meetingStartTime: Date) => {
    const today = moment().format('DD-MM-YYYY');

    if (today === moment(meetingStartTime).format('DD-MM-YYYY')) {
      return this.configService.get<string>('notification.emailQueueUrlFast');
    }
    return this.configService.get<string>('notification.emailQueueUrlStandard');
  }

  public renameTemplateContentFieldsToUpperCase(content: string): string {
    if (content?.length) {
      return  content.replace(/\{{2}\w+\}{2}/gm, (str: string) => { return str.toUpperCase(); })
    }
    return content ?? "";
  }

  public replaceDynamicValue(templateId: number, content: string, data: Record<string,any>): string {
    
    try{
      let newContent = this.renameTemplateContentFieldsToUpperCase(content);

      Object.keys(data).forEach((key:string) => {
        if (newContent?.length && newContent.includes(key)) {
          newContent = newContent.replace(key, data[key]);
        }
      });
      return newContent;
    }catch{

      return "";

    }
  }

  public replaceDynamicValueForRow(content: string, data: Record<string,any>): string {
    let newContent = this.renameTemplateContentFieldsToUpperCase(content);

    let replaceResult: string[] = [];
    Object.keys(data).forEach((key:string) => {
      if (newContent.includes(key)) {
        replaceResult.push(`${key} found`);
        newContent = newContent.replace(key, data[key]);
      } else {
        replaceResult.push(`${key} not found`);
      }
    });
    return newContent;
  }

  public generateC2MLink = (meetingStatus: string, fairCode: string, language: string) => {
    // to-do - jack - language (exhibitor)
    if (!language) {
      language = 'en';
    }
    switch(true) {
      case meetingStatus.toUpperCase() === "PENDING":
        return `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${language}/c2m-meeting/meeting?tab=pending_self_respond`;

      // case meetingStatus.toUpperCase() === "PENDINGRESPONDER":
      //   return `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${language}/c2m-meeting/meeting?redirectTo=pendingResponder`;
      
      case meetingStatus.toUpperCase() === "CANCEL":
        return `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${language}/c2m-meeting/meeting?tab=pending_self_respond&receiverId=cancel`;
      
      case meetingStatus.toUpperCase() === "UPCOMING":
        return `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${language}/c2m-meeting/meeting?tab=pending_self_respond&receiverId=upcoming`;

      default:
        return "";
    }
  }

  public async prepareDynamicContent(data: Meeting, userProfile: Record<string, any>, templateId: NotificationTemplatesId, fairData: Record<string, any>, timezone: string, counterProfile: Record<string, any>, receiverFairCode: string): Promise<any> {
    const buyerName = data.responderRole === MeetingRole.BUYER ? `${data.responderFirstName} ${data.responderLastName}` : `${data.requesterFirstName} ${data.requesterLastName}`;
    const exhibitorName = data.responderRole === MeetingRole.EXHIBITOR ? `${data.responderFirstName} ${data.responderLastName}` : `${data.requesterFirstName} ${data.requesterLastName}`;
    const autoCancelRemaingHours = "96";
    const meetingTypeEn = data.type ? 'F2F' : 'ONLINE';
    const meetingTypeTc = data.type ? '面交' : '線上';
    const meetingTypeSc = data.type ? '面交' : '在线';
    // const receiverRole = userProfile.userId === data.requesterSsoUid ? data.requesterRole : data.responderRole;

    const targetFairCode = userProfile.userId === data.requesterSsoUid ? data.responderFairCode : data.fairCode;
    const targetFairCodeBm = userProfile.userId === data.requesterSsoUid ? data.fairCode : data.responderFairCode;

    // define requestor / responder profile base on requesterSsoUid  (meeting table )
    let requesterProfile;
    let responderProfile;  
    let myName;
    let counterName;

    if(userProfile.userId === data.requesterSsoUid){
      requesterProfile = userProfile;
      responderProfile = counterProfile;  
      myName = `${data.requesterFirstName} ${data.requesterLastName}`;
      counterName = `${data.responderFirstName} ${data.responderLastName}`;
    }else{
      requesterProfile = counterProfile;
      responderProfile = userProfile; 
      myName = `${data.responderFirstName} ${data.responderLastName}`;
      counterName = `${data.requesterFirstName} ${data.requesterLastName}`;
    } 

    // define buyer / exhibitoe profile base on requesterRole  (meeting table )
    let buyerProfile;
    let exhibitorProfile;  

    if(data.requesterRole=== MeetingRole.BUYER){
      buyerProfile = requesterProfile;
      exhibitorProfile = responderProfile;  
    }else{
      buyerProfile = responderProfile;
      exhibitorProfile = requesterProfile;  
    } 

    // handle some data for ID = 40, 41, 42, 43
    let exhibitorFairData = null;
    let buyerFairData = null;
    if( templateId=== NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_BUYER ||
      templateId=== NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR ||
      templateId=== NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_BUYER ||
      templateId=== NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR ) {
        exhibitorFairData = await this.fairService.getNamesObj(data?.responderFairCode);
        buyerFairData = await this.fairService.getNamesObj(data?.fairCode);
    }
    console.log(exhibitorFairData)
    
    switch(templateId) {
      case NotificationTemplatesId.CREATE_MEETING: 
        return {
          'CANCEL_ORIGINAL_MEETING_HOUR': "48",
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_PENDINGACCEPT_EN': `<a href=${this.generateC2MLink("PENDING", data.responderFairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_PENDINGACCEPT_SC': `<a href=${this.generateC2MLink("PENDING", data.responderFairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_PENDINGACCEPT_TC': `<a href=${this.generateC2MLink("PENDING", data.responderFairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'REQUESTER_COMPANY_NAME': counterProfile.companyName,
          'REQUESTER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.RESCHEDULE_MEETING:
        return {
          'CANCEL_ORIGINAL_MEETING_HOUR': autoCancelRemaingHours,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_PENDINGACCEPT_EN': `<a href=${this.generateC2MLink("PENDING", data.responderFairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_PENDINGACCEPT_SC': `<a href=${this.generateC2MLink("PENDING", data.responderFairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_PENDINGACCEPT_TC': `<a href=${this.generateC2MLink("PENDING", data.responderFairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'REQUESTER_COMPANY_NAME': counterProfile.companyName,
          'REQUESTER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.REJECT_MEETING:
        return {
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_CANCEL_EN': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_CANCEL_SC': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_CANCEL_TC': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'REQUESTER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'RESPONDER_COMPANY_NAME': counterProfile.companyName,
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.CANCEL_MEETING:
        return {
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_CANCEL_EN': `<a href=${this.generateC2MLink("CANCEL", targetFairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_CANCEL_SC': `<a href=${this.generateC2MLink("CANCEL", targetFairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_CANCEL_TC': `<a href=${this.generateC2MLink("CANCEL", targetFairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'REQUESTER_COMPANY_NAME': counterProfile.companyName,
          'REQUESTER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.AUTO_CANCEL_MEETING:
        return {
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_CANCEL_EN': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_CANCEL_SC': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_CANCEL_TC': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'REQUESTER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'RESPONDER_COMPANY_NAME': counterProfile.companyName,
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.BM_CREATE_MEETING_NO_PENDING_MEETING_TO_BUYER:
        return {
          'BUYER_COMPANY_NAME': buyerProfile.companyName,
          'BUYER_COUNTRY_EN': buyerProfile.country,
          'BUYER_NAME': buyerName,
          'EXHIBITOR_COMPANY_NAME': exhibitorProfile.companyName,
          'EXHIBITOR_COUNTRY_EN': exhibitorProfile.country,
          'EXHIBITOR_COUNTRY_SC': exhibitorProfile.country,
          'EXHIBITOR_COUNTRY_TC': exhibitorProfile.country,
          'EXHIBITOR_NAME': exhibitorName,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_SC': fairData.Fair_long_name_SC,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, buyerProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, buyerProfile.userTimezone).format('HH:mm'),
          'MEETING_TYPE_EN': meetingTypeEn,
          'MEETING_TYPE_SC': meetingTypeSc,
          'MEETING_TYPE_TC': meetingTypeTc,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), buyerProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.BM_CREATE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR:
        return {
          'BUYER_COMPANY_NAME': buyerProfile.companyName,
          'BUYER_COUNTRY_EN': buyerProfile.country,
          'BUYER_COUNTRY_SC': buyerProfile.country,
          'BUYER_COUNTRY_TC': buyerProfile.country,
          'BUYER_NAME': buyerName,
          'EXHIBITOR_COMPANY_NAME': exhibitorProfile.companyName,
          'EXHIBITOR_NAME': exhibitorName,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_SC': fairData.Fair_long_name_SC,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, exhibitorProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME_EN': moment.tz(data.startTime, exhibitorProfile.userTimezone).format('HH:mm'),
          'MEETING_TIME': moment.tz(data.startTime, exhibitorProfile.userTimezone).format('HH:mm'),
          'MEETING_TYPE_EN': meetingTypeEn,
          'MEETING_TYPE_SC': meetingTypeSc,
          'MEETING_TYPE_TC': meetingTypeTc,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), exhibitorProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.BM_CREATE_MEETING_WITH_PENDING_MEETING_TO_BUYER:
        return {
          'BUYER_COMPANY_NAME': buyerProfile.companyName,
          'BUYER_COUNTRY_EN': buyerProfile.country,
          'BUYER_NAME': buyerName,
          'EXHIBITOR_COMPANY_NAME': exhibitorProfile.companyName,
          'EXHIBITOR_COUNTRY': exhibitorProfile.country,
          'EXHIBITOR_NAME': exhibitorName,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_SC': fairData.Fair_long_name_SC,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>此處</a>`,
          'LINK_UPCOMING_EN_S': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC_S': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>"待处理会议请求"</a>`,
          'LINK_UPCOMING_TC_S': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>"待處理會議請求"</a>`,
          'MEETING_DATE': moment.tz(data.startTime, buyerProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, buyerProfile.userTimezone).format('HH:mm'),
          'MEETING_TYPE_EN': meetingTypeEn,
          'MEETING_TYPE_SC': meetingTypeSc,
          'MEETING_TYPE_TC': meetingTypeTc,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), buyerProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.BM_CREATE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR:
        return {
          'BUYER_COMPANY_NAME': buyerProfile.companyName,
          'BUYER_COUNTRY': buyerProfile.country,
          'BUYER_NAME': buyerName,
          'EXHIBITOR_COMPANY_NAME': exhibitorProfile.companyName,
          'EXHIBITOR_NAME': exhibitorName,
          'EXHIBITOR_COUNTRY_EN': exhibitorProfile.country,
          'EXHIBITOR_COUNTRY_TC': exhibitorProfile.country,
          'EXHIBITOR_COUNTRY_SC': exhibitorProfile.country,
          'EXHIBITOR_COUNTRY': exhibitorProfile.country,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_SC': fairData.Fair_long_name_SC,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_PENDINGACCEPT_EN': `<a href=${this.generateC2MLink("PENDINGRESPONDER", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>HERE</a>`,
          'LINK_PENDINGACCEPT_SC': `<a href=${this.generateC2MLink("PENDINGRESPONDER", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>"待处理会议请求"</a>`,
          'LINK_PENDINGACCEPT_TC': `<a href=${this.generateC2MLink("PENDINGRESPONDER", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>"待處理會議請求"</a>`,
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, exhibitorProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, exhibitorProfile.userTimezone).format('HH:mm'),
          'MEETING_TYPE_EN': meetingTypeEn,
          'MEETING_TYPE_SC': meetingTypeSc,
          'MEETING_TYPE_TC': meetingTypeTc,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), exhibitorProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_BUYER:
        return {
          'BUYER_COMPANY_NAME': buyerProfile.companyName,
          'BUYER_COUNTRY_EN': buyerProfile.country,
          'BUYER_NAME': buyerName,
          'EXHIBITOR_COMPANY_NAME': exhibitorProfile.companyName,
          'EXHIBITOR_COUNTRY_EN': exhibitorProfile.country,
          'EXHIBITOR_COUNTRY_SC': exhibitorProfile.country,
          'EXHIBITOR_COUNTRY_TC': exhibitorProfile.country,
          'EXHIBITOR_NAME': exhibitorName,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_SC': fairData.Fair_long_name_SC,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'EXHIBITOR_FAIR_SHORT_NAME': exhibitorFairData?.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, buyerProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, buyerProfile.userTimezone).format('HH:mm'),
          'MEETING_TYPE_EN': meetingTypeEn,
          'MEETING_TYPE_SC': meetingTypeSc,
          'MEETING_TYPE_TC': meetingTypeTc,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), buyerProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR:
        return {
          'BUYER_COMPANY_NAME': buyerProfile.companyName,
          'BUYER_COUNTRY_EN': buyerProfile.country,
          'BUYER_COUNTRY_SC': buyerProfile.country,
          'BUYER_COUNTRY_TC': buyerProfile.country,
          'BUYER_NAME': buyerName,
          'EXHIBITOR_COMPANY_NAME': exhibitorProfile.companyName,
          'EXHIBITOR_NAME': exhibitorName,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_SC': fairData.Fair_long_name_SC,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'BUYER_FAIR_SHORT_NAME': buyerFairData?.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, exhibitorProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME_EN': moment.tz(data.startTime, exhibitorProfile.userTimezone).format('HH:mm'),
          'MEETING_TIME': moment.tz(data.startTime, exhibitorProfile.userTimezone).format('HH:mm'),
          'MEETING_TYPE_EN': meetingTypeEn,
          'MEETING_TYPE_SC': meetingTypeSc,
          'MEETING_TYPE_TC': meetingTypeTc,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), exhibitorProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_BUYER:
        return {
          'BUYER_COMPANY_NAME': buyerProfile.companyName,
          'BUYER_COUNTRY_EN': buyerProfile.country,
          'BUYER_NAME': buyerName,
          'EXHIBITOR_COMPANY_NAME': exhibitorProfile.companyName,
          'EXHIBITOR_COUNTRY': exhibitorProfile.country,
          'EXHIBITOR_NAME': exhibitorName,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_SC': fairData.Fair_long_name_SC,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'EXHIBITOR_FAIR_SHORT_NAME': exhibitorFairData?.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>此處</a>`,
          'LINK_UPCOMING_EN_S': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC_S': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>"待处理会议请求"</a>`,
          'LINK_UPCOMING_TC_S': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, buyerProfile.preferredLanguage)}>"待處理會議請求"</a>`,
          'MEETING_DATE': moment.tz(data.startTime, buyerProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, buyerProfile.userTimezone).format('HH:mm'),
          'MEETING_TYPE_EN': meetingTypeEn,
          'MEETING_TYPE_SC': meetingTypeSc,
          'MEETING_TYPE_TC': meetingTypeTc,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), buyerProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR:
        return {
          'BUYER_COMPANY_NAME': buyerProfile.companyName,
          'BUYER_COUNTRY': buyerProfile.country,
          'BUYER_NAME': buyerName,
          'EXHIBITOR_COMPANY_NAME': exhibitorProfile.companyName,
          'EXHIBITOR_NAME': exhibitorName,
          'EXHIBITOR_COUNTRY_EN': exhibitorProfile.country,
          'EXHIBITOR_COUNTRY_TC': exhibitorProfile.country,
          'EXHIBITOR_COUNTRY_SC': exhibitorProfile.country,
          'EXHIBITOR_COUNTRY': exhibitorProfile.country,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_SC': fairData.Fair_long_name_SC,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'BUYER_FAIR_SHORT_NAME': buyerFairData?.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_PENDINGACCEPT_EN': `<a href=${this.generateC2MLink("PENDINGRESPONDER", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>HERE</a>`,
          'LINK_PENDINGACCEPT_SC': `<a href=${this.generateC2MLink("PENDINGRESPONDER", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>"待处理会议请求"</a>`,
          'LINK_PENDINGACCEPT_TC': `<a href=${this.generateC2MLink("PENDINGRESPONDER", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>"待處理會議請求"</a>`,
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", targetFairCodeBm, exhibitorProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, exhibitorProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, exhibitorProfile.userTimezone).format('HH:mm'),
          'MEETING_TYPE_EN': meetingTypeEn,
          'MEETING_TYPE_SC': meetingTypeSc,
          'MEETING_TYPE_TC': meetingTypeTc,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), exhibitorProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR:
        return {
          'CANCEL_ORIGINAL_MEETING_HOUR': autoCancelRemaingHours,
          'CANCEL_RESCHEDULE_MEETING_HOUR': autoCancelRemaingHours,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_PENDINGACCEPT_EN': `<a href=${this.generateC2MLink("PENDING", targetFairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_PENDINGACCEPT_SC': `<a href=${this.generateC2MLink("PENDING", targetFairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_PENDINGACCEPT_TC': `<a href=${this.generateC2MLink("PENDING", targetFairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'REQUESTER_COMPANY_NAME': counterProfile.companyName,
          'REQUESTER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.CANCEL_BM_MEETING_BY_BM_TO_RESPONDER:
        return {
          'COUNTERPART_COMPANY_NAME': counterProfile.companyName,
          'COUNTERPART_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_SC': fairData.Fair_long_name_SC,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_CANCEL_EN': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_CANCEL_SC': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_CANCEL_TC': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.CANCEL_BM_MEETING_BY_BUYER_OR_EXHIBITOR:
        return {
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_CANCEL_EN': `<a href=${this.generateC2MLink("CANCEL", targetFairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_CANCEL_SC': `<a href=${this.generateC2MLink("CANCEL", targetFairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_CANCEL_TC': `<a href=${this.generateC2MLink("CANCEL", targetFairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'COUNTERPART_COMPANY_NAME': counterProfile.companyName,
          'COUNTERPART_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.CANCEL_BM_MEETING_BY_BM_TO_REQUESTER:
        return {
          'COUNTERPART_COMPANY_NAME': counterProfile.companyName,
          'COUNTERPART_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'FAIR_LONG_NAME_EN': fairData.Fair_long_name_EN,
          'FAIR_LONG_NAME_SC': fairData.Fair_long_name_SC,
          'FAIR_LONG_NAME_TC': fairData.Fair_long_name_TC,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_CANCEL_EN': `<a href=${this.generateC2MLink("CANCEL", data.responderFairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_CANCEL_SC': `<a href=${this.generateC2MLink("CANCEL", data.responderFairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_CANCEL_TC': `<a href=${this.generateC2MLink("CANCEL", data.responderFairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'REQUESTER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.ACCEPT_MEETING_TO_REQUESTER:
        return {
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", data.fairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", data.fairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", data.fairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'REQUESTER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'RESPONDER_COMPANY_NAME': counterProfile.companyName,
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.ACCEPT_MEETING_TO_RESPONDER:
        return {
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", data.responderFairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", data.responderFairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", data.responderFairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'REQUESTER_COMPANY_NAME': counterProfile.companyName,
          'REQUESTER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`
        };
      case NotificationTemplatesId.CANCEL_C2M_MEETING_BY_BM_TO_REQUESTER:
        return {
          'REQUESTER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'COUNTERPART_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'COUNTERPART_COMPANY_NAME': counterProfile.companyName,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`,
          'LINK_CANCEL_EN': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_CANCEL_SC': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_CANCEL_TC': `<a href=${this.generateC2MLink("CANCEL", data.fairCode, userProfile.preferredLanguage)}>此處</a>`,
        };
      case NotificationTemplatesId.CANCEL_C2M_MEETING_BY_BM_TO_RESPONDER:
        return {
          'RESPONDER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'COUNTERPART_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'COUNTERPART_COMPANY_NAME': counterProfile.companyName,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`,
          'LINK_CANCEL_EN': `<a href=${this.generateC2MLink("CANCEL", data.responderFairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_CANCEL_SC': `<a href=${this.generateC2MLink("CANCEL", data.responderFairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_CANCEL_TC': `<a href=${this.generateC2MLink("CANCEL", data.responderFairCode, userProfile.preferredLanguage)}>此處</a>`,
        };
      case NotificationTemplatesId.MEETING_REMINDER:
        let configTime: number;

        const query = `SELECT * FROM vep_c2m_service_db.vepC2MConfig where id = 11`;

        const connection = await getConnection('contentDatabase');
        const slaveRunner = connection.createQueryRunner('slave');
        let result: any;
        try {
          result = await connection.query(query, undefined, slaveRunner);
        } catch (error) {
          console.log("Error in prepareDynamicContent api", error);
        } finally {
          slaveRunner.release();
        }

        configTime = Number(result[0]?.configValue);
        console.log(`Minutes before sent out meeting reminder in c2mConfig table: ${configTime}`);

        if (!result.length) {
          // set startTime before 15 mins will send noti (default value = 15)
          configTime = 15;
        }

        return {
          'CONFIG_VALUE': configTime,
          '({{COUNTERPART_COUNTRY}})': counterProfile.country,
          'COUNTERPART_COMPANY_NAME': counterProfile.companyName,
          'COUNTERPART_COUNTRY': counterProfile.country,
          'COUNTERPART_NAME': counterName,
          'FAIR_SHORT_NAME': fairData.Fair_Short_Name?.[userProfile.preferredLanguage],
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", receiverFairCode, userProfile.preferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", receiverFairCode, userProfile.preferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", receiverFairCode, userProfile.preferredLanguage)}>此處</a>`,
          'MEETING_DATE': moment.tz(data.startTime, userProfile.userTimezone).format('DD-MM-YYYY'),
          'MEETING_TIME': moment.tz(data.startTime, userProfile.userTimezone).format('HH:mm'),
          'REQUESTER_COMPANY_NAME': requesterProfile.companyName,
          'REQUESTER_NAME': `${data.requesterFirstName} ${data.requesterLastName}`,
          'RESPONDER_COMPANY_NAME': responderProfile.companyName,
          'RESPONDER_NAME': `${data.responderFirstName} ${data.responderLastName}`,
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userProfile.userTimezone).format('Z').replace(/0/, '').replace(/:00/, '')}`,
          'USER_NAME': myName,
          'USER_COMPANY': userProfile.companyName
        };
    }
    
  }

  public async prepareDynamicContentForSummary(meeting: Record<string, any>, templateId: NotificationTemplatesId, userId: string): Promise<any> {

    //get user profile base on any one of meeting data
    let firstMeetingData = meeting[0]
    let userRole = '';
    let userPreferredLanguage = '';
    let userTimezone = '';
    let userFirstName = '';
    let userLastName = '';
    let userFairShortName = '';
    let userFaircode = '';
    // let userFiscalYear = '';

    let buyerFairShortNameObject: any = {}
    if (firstMeetingData?.buyerFairShortName?.length) {
      buyerFairShortNameObject = JSON.parse(firstMeetingData?.buyerFairShortName)
    }

    let exhibitorFairShortNameObject: any = {}
    if (firstMeetingData?.exhibitorFairShortName?.length) {
      exhibitorFairShortNameObject = JSON.parse(firstMeetingData?.exhibitorFairShortName)
    }

    if (userId === firstMeetingData.buyerSsoUid) {
      userRole = ReceiverRole.BUYER;
      userPreferredLanguage = firstMeetingData?.buyerPreferredLanguage || 'en';
      userTimezone = firstMeetingData?.buyerTimezone || 'Asia/Hong_Kong';
      userFirstName = firstMeetingData?.buyerFirstName;
      userLastName = firstMeetingData?.buyerLastName;
      userFairShortName = buyerFairShortNameObject[firstMeetingData?.buyerPreferredLanguage] ?? 'en';
      userFaircode = firstMeetingData?.buyerFairCode;
      // userFiscalYear = firstMeetingData.buyerFiscalYear; 

    } else {
      userRole = ReceiverRole.EXHIBITOR;
      userPreferredLanguage = firstMeetingData?.exhibitorPreferredLanguage || 'en';
      userTimezone = firstMeetingData?.exhibitorUserTimezone || 'Asia/Hong_Kong';
      userFirstName = firstMeetingData?.exhibitorFirstName;
      userLastName = firstMeetingData?.exhibitorLastName;
      userFairShortName = exhibitorFairShortNameObject[firstMeetingData?.exhibitorPreferredLanguage] ?? 'en';
      userFaircode = firstMeetingData?.exhibitorFairCode;
      // userFiscalYear = firstMeetingData.exhibitorFiscalYear;  
    }


  
    console.log(userRole, userTimezone)
    const tdStyle = 'style="border: 1px solid #dddddd; text-align: left; padding: 8px;"'
    let emailTableHeader: string
    let emailTableRow: string
    if (userPreferredLanguage === 'tc') {
      emailTableHeader =
      `<tr>
      <td ${tdStyle}><div>序號</div></td>
      <td ${tdStyle}><div>日期</div></td>
      <td ${tdStyle}><div>時間</div></td>
      <td ${tdStyle}><div>時區</div></td>
      <td ${tdStyle}><div>會議類型</div></td>
      <td ${tdStyle}><div>參與者類型</div></td>
      <td ${tdStyle}><div>參與者名稱</div></td>
      <td ${tdStyle}><div>參與者公司名稱</div></td>
      <td ${tdStyle}><div>參與者國家</div></td>
      </tr>`;

      emailTableRow =
      `<tr>
      <td ${tdStyle}><div><br>{{NO}}<br></div></td>
      <td ${tdStyle}><div><br>{{MEETING_DATE}}<br></div></td>
      <td ${tdStyle}><div><br>{{MEETING_TIME}}<br></div></td>
      <td ${tdStyle}><div><br>{{SELFTIMEZONE}}<br></div></td>
      <td ${tdStyle}><div><br>{{MEETING_TYPE_TC}}<br></div></td>
      <td ${tdStyle}><div><br>{{COUNTERPART_TYPE_TC}}<br></div></td>
      <td ${tdStyle}><div><br>​{{COUNTERPART_NAME}}<br></div></td>
      <td ${tdStyle}><div><br>​{{COUNTERPART_COMPANY_NAME}}<br></div></td>
      <td ${tdStyle}><div><br>​{{COUNTERPART_COUNTRY_TC}}<br></div></td>
      </tr>`;
    } else if (userPreferredLanguage === 'sc') {
      emailTableHeader =
      `<tr>
      <td ${tdStyle}><div>序号</div></td>
      <td ${tdStyle}><div>日期</div></td>
      <td ${tdStyle}><div>时间</div></td>
      <td ${tdStyle}><div>时区</div></td>
      <td ${tdStyle}><div>会议类型</div></td>
      <td ${tdStyle}><div>参与者类型</div></td>
      <td ${tdStyle}><div>参与者名称</div></td>
      <td ${tdStyle}><div>参与者公司名称</div></td>
      <td ${tdStyle}><div>参与者国家</div></td>
      </tr>`;

      emailTableRow =
      `<tr>
      <td ${tdStyle}><div><br>{{NO}}<br></div></td>
      <td ${tdStyle}><div><br>{{MEETING_DATE}}<br></div></td>
      <td ${tdStyle}><div><br>{{MEETING_TIME}}<br></div></td>
      <td ${tdStyle}><div><br>{{SELFTIMEZONE}}<br></div></td>
      <td ${tdStyle}><div><br>{{MEETING_TYPE_SC}}<br></div></td>
      <td ${tdStyle}><div><br>{{COUNTERPART_TYPE_SC}}<br></div></td>
      <td ${tdStyle}><div><br>​{{COUNTERPART_NAME}}<br></div></td>
      <td ${tdStyle}><div><br>​{{COUNTERPART_COMPANY_NAME}}<br></div></td>
      <td ${tdStyle}><div><br>​{{COUNTERPART_COUNTRY_SC}}<br></div></td>
      </tr>`;
    } else {
      emailTableHeader =
      `<tr>
      <td ${tdStyle}><div>No.</div></td>
      <td ${tdStyle}><div>Date</div></td>
      <td ${tdStyle}><div>Time</div></td>
      <td ${tdStyle}><div>Time zone</div></td>
      <td ${tdStyle}><div>Meeting Type</div></td>
      <td ${tdStyle}><div>Participant Type</div></td>
      <td ${tdStyle}><div>Participant Name</div></td>
      <td ${tdStyle}><div>Participant Company Name</div></td>
      <td ${tdStyle}><div>Participant Country</div></td>
      </tr>`;

      emailTableRow =
      `<tr>
      <td ${tdStyle}><div><br>{{NO}}<br></div></td>
      <td ${tdStyle}><div><br>{{MEETING_DATE}}<br></div></td>
      <td ${tdStyle}><div><br>{{MEETING_TIME}}<br></div></td>
      <td ${tdStyle}><div><br>{{SELFTIMEZONE}}<br></div></td>
      <td ${tdStyle}><div><br>{{MEETING_TYPE_EN}}<br></div></td>
      <td ${tdStyle}><div><br>{{COUNTERPART_TYPE_EN}}<br></div></td>
      <td ${tdStyle}><div><br>​{{COUNTERPART_NAME}}<br></div></td>
      <td ${tdStyle}><div><br>​{{COUNTERPART_COMPANY_NAME}}<br></div></td>
      <td ${tdStyle}><div><br>​{{COUNTERPART_COUNTRY_EN}}<br></div></td>
      </tr>`;
    }

    let allEmailTableRow: string = '';
    let emailTable;
    let newEmailTableRow;

    // get counter profile base on each of meeting data
    let meetingNumber: number = 0;
    meeting.forEach((meetingRecord: any) => { 
      meetingNumber = meetingNumber + 1;
      // prepare table data
      const preparedDynamicWordsForTable = this.prepareDynamicContentForSummaryTable(meetingRecord, templateId, userId, userTimezone, meetingNumber);
      // replace datat to the table
      newEmailTableRow = this.replaceDynamicValueForRow(emailTableRow, preparedDynamicWordsForTable)
      // append new row to the table
      allEmailTableRow = allEmailTableRow + newEmailTableRow;

      console.log(allEmailTableRow)
    })
    emailTable = emailTableHeader + allEmailTableRow
    console.log(emailTable);

    // let tableHeader = ''
    // let tableRow = ''

    // tableData = tableHeader + tableRow ;

    switch(templateId) {
      case NotificationTemplatesId.DAILY_MEETING_SUMMARY:
        return {
          'USER_NAME': `${userFirstName} ${userLastName}`,
          'FAIR_SHORT_NAME': userFairShortName,
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", userFaircode, userPreferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", userFaircode, userPreferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", userFaircode, userPreferredLanguage)}>此處</a>`,
          'TABLE': emailTable
        }; 
      case NotificationTemplatesId.C2M_START_REMINDER:
        return {
          'BUYER_NAME/EXHIBITOR_NAME': `${userFirstName} ${userLastName}`,
          'CURRENT_DATE': moment.tz(moment(), userTimezone).format('DD-MM-YYYY HH:mm'),
          'SELFTIMEZONE': `UTC/GMT${moment.tz(moment(), userTimezone).format('Z').replace(/:00/, '').replace(/0/, '')}`,
          'FAIR_SHORT_NAME': userFairShortName,
          'LINK_UPCOMING_EN': `<a href=${this.generateC2MLink("UPCOMING", userFaircode, userPreferredLanguage)}>HERE</a>`,
          'LINK_UPCOMING_SC': `<a href=${this.generateC2MLink("UPCOMING", userFaircode, userPreferredLanguage)}>此处</a>`,
          'LINK_UPCOMING_TC': `<a href=${this.generateC2MLink("UPCOMING", userFaircode, userPreferredLanguage)}>此處</a>`,
          'TABLE': emailTable
        }; 
    }
  }

  public prepareDynamicContentForSummaryTable(meetingRecord: Record<string, any>, templateId: number, userId: string, userTimezone: string, meetingNumber: number): Record<string, any> {
      const meetingTypeEn = meetingRecord?.type ? 'F2F' : 'ONLINE';
      const meetingTypeTc = meetingRecord?.type ? '面交' : '線上';
      const meetingTypeSc = meetingRecord?.type ? '面交' : '在线';

      let counterRoleEn;
      let counterRoleTc;
      let counterRoleSc;
      let counterFirstName;
      let counterLastName;
      let counterCompanyName;
      let counterCountryEn;
      let counterCountryTc;
      let counterCountrySc;
      // let changeBackToUTC;
      // let changeBackToUTCMoment;
      let userMeetingDateWithUserTZ;
      if (userId === meetingRecord?.buyerSsoUid) {
        counterRoleEn = 'EXHIBITOR';
        counterRoleTc = '參展商';
        counterRoleSc = '参展商';
        counterFirstName = meetingRecord?.exhibitorFirstName;
        counterLastName = meetingRecord?.exhibitorLastName;
        counterCompanyName = meetingRecord?.exhibitorcompanyName;
        counterCountryEn = meetingRecord?.exhibitorCountryEN;
        counterCountryTc = meetingRecord?.exhibitorCountrySC;
        counterCountrySc = meetingRecord?.exhibitorCountryTC;
      } else {
        counterRoleEn = 'BUYER';
        counterRoleTc = '買家';
        counterRoleSc = '买家';
        counterFirstName = meetingRecord?.buyerFirstName;
        counterLastName = meetingRecord?.buyerLastName;
        counterCompanyName = meetingRecord?.buyerCompanyName;
        counterCountryEn = meetingRecord?.buyerCountryEN;
        counterCountryTc = meetingRecord?.buyerCountryTC;
        counterCountrySc = meetingRecord?.buyerCountrySC;
      }

    switch (templateId){
      case NotificationTemplatesId.DAILY_MEETING_SUMMARY:
        userMeetingDateWithUserTZ = moment(meetingRecord?.startTime).tz(userTimezone);

        return {
          '{{COUNTERPART_COMPANY_NAME}}': counterCompanyName,
          '{{COUNTERPART_COUNTRY_EN}}': counterCountryEn,
          '{{COUNTERPART_COUNTRY_TC}}': counterCountryTc,
          '{{COUNTERPART_COUNTRY_SC}}': counterCountrySc,
          '{{COUNTERPART_NAME}}': `${counterFirstName} ${counterLastName}`,
          '{{COUNTERPART_TYPE_EN}}': counterRoleEn,
          '{{COUNTERPART_TYPE_SC}}': counterRoleSc,
          '{{COUNTERPART_TYPE_TC}}': counterRoleTc,
          '{{MEETING_DATE}}': userMeetingDateWithUserTZ.format('DD-MM-YYYY'),
          '{{MEETING_TIME}}': userMeetingDateWithUserTZ.format('HH:mm'),
          '{{MEETING_TYPE_EN}}': meetingTypeEn,
          '{{MEETING_TYPE_TC}}': meetingTypeTc,
          '{{MEETING_TYPE_SC}}': meetingTypeSc,
          '{{SELFTIMEZONE}}': `UTC/GMT${moment.tz(moment(), userTimezone).format('Z').replace(/:00/, '')}`,
          '{{NO}}': meetingNumber,
        };
        case NotificationTemplatesId.C2M_START_REMINDER:
          userMeetingDateWithUserTZ = moment(meetingRecord?.startTime).tz(userTimezone);

          return {
            '{{COUNTERPART_COMPANY_NAME}}': counterCompanyName,
            '{{COUNTERPART_COUNTRY_EN}}': counterCountryEn,
            '{{COUNTERPART_COUNTRY_TC}}': counterCountryTc,
            '{{COUNTERPART_COUNTRY_SC}}': counterCountrySc,
            '{{COUNTERPART_NAME}}': `${counterFirstName} ${counterLastName}`,
            '{{COUNTERPART_TYPE_EN}}': counterRoleEn,
            '{{COUNTERPART_TYPE_SC}}': counterRoleSc,
            '{{COUNTERPART_TYPE_TC}}': counterRoleTc,
            '{{MEETING_DATE}}': userMeetingDateWithUserTZ.format('DD-MM-YYYY'),
            '{{MEETING_TIME}}': userMeetingDateWithUserTZ.format('HH:mm'),
            '{{MEETING_TYPE_EN}}': meetingTypeEn,
            '{{MEETING_TYPE_TC}}': meetingTypeTc,
            '{{MEETING_TYPE_SC}}': meetingTypeSc,
            '{{SELFTIMEZONE}}': `UTC/GMT${moment.tz(moment(), userTimezone).format('Z').replace(/:00/, '').replace(/0/, '')}`,
            '{{NO}}': meetingNumber,
          };
      default:
        return {};
    }
  }

  public prepareDynamicContentForProductImage(product: Record<string, any>): Record<string, any> {
    return {
      '{{PRODUCT_IMAGE}}': product?.productImageUrl
    }
  }

  public prepareDynamicContentForCard(
    recommendExhibitors: any,
    productImageUrl_0: string,
    productImageUrl_1: string,
    productImageUrl_2: string,
    productImageUrl_3: string,
    verifiedLabel_0: string,
    verifiedLabel_1: string,
    verifiedLabel_2: string,
    verifiedLabel_3: string,
    virtualBoothImageUrl: string,
  ): Record<string, any> {
    return {
      '{{COMPANY_LOGO_0}}': recommendExhibitors[0]?.companyLogo ? `<img src='${recommendExhibitors[0]?.companyLogo}' width='198' height='40'>` : '<div>&nbsp;</div>',
      '{{EXHIBITOR_NAME_0}}': `<b>${recommendExhibitors[0]?.exhibitorName}</b>`,
      '{{LOCATION_EN_0}}': recommendExhibitors[0]?.locationEn,
      '{{LOCATION_TC_0}}': recommendExhibitors[0]?.locationTc,
      '{{LOCATION_SC_0}}': recommendExhibitors[0]?.locationSc,
      '{{BOOTH_EN_0}}': recommendExhibitors[0]?.exhibitorType === 'Online' ? 'Online' : recommendExhibitors[0]?.booth.length !== 0 ? `Booth: ${recommendExhibitors[0]?.booth[0]}` : `&nbsp;`,
      '{{BOOTH_TC_0}}': recommendExhibitors[0]?.exhibitorType === 'Online' ? '線上' : recommendExhibitors[0]?.booth.length !== 0 ? `展位編號: ${recommendExhibitors[0]?.booth[0]}` : `&nbsp;`,
      '{{BOOTH_SC_0}}': recommendExhibitors[0]?.exhibitorType === 'Online' ? '线上' : recommendExhibitors[0]?.booth.length !== 0 ? `展位编号: ${recommendExhibitors[0]?.booth[0]}` : `&nbsp;`,
      '{{ZONE_PAVILIONS_EN_0}}': recommendExhibitors[0]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[0]?.zone.length !== 0 ? (recommendExhibitors[0]?.pavilions.length !== 0 ? recommendExhibitors[0]?.zone[0]?.zoneNameEn + ' | ' + recommendExhibitors[0]?.pavilions[0]?.pavilionNameEn : recommendExhibitors[0]?.zone[0]?.zoneNameEn) : '&nbsp;',
      '{{ZONE_PAVILIONS_TC_0}}': recommendExhibitors[0]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[0]?.zone.length !== 0 ? (recommendExhibitors[0]?.pavilions.length !== 0 ? recommendExhibitors[0]?.zone[0]?.zoneNameZhHant + ' | ' + recommendExhibitors[0]?.pavilions[0]?.pavilionNameZhHant : recommendExhibitors[0]?.zone[0]?.zoneNameZhHant) : '&nbsp;',
      '{{ZONE_PAVILIONS_SC_0}}': recommendExhibitors[0]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[0]?.zone.length !== 0 ? (recommendExhibitors[0]?.pavilions.length !== 0 ? recommendExhibitors[0]?.zone[0]?.zoneNameZhHans + ' | ' + recommendExhibitors[0]?.pavilions[0]?.pavilionNameZhHans : recommendExhibitors[0]?.zone[0]?.zoneNameZhHans) : '&nbsp;',
      '{{VIRTUAL_BOOTH_LABEL_0}}': recommendExhibitors[0]?.virtualBoothType === null ? '&nbsp;' : `<img src=${virtualBoothImageUrl} width='111' height='61'>`,
      '{{VERIFIED_LABEL_0}}': verifiedLabel_0,
      '{{PRODUCT_IMAGE_EN_0}}': recommendExhibitors[0]?.productImageUrl[0] ? `<b>Highlighted Products</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_0}</div>` : '<b>Highlighted Products - No photo available</b>',
      '{{PRODUCT_IMAGE_TC_0}}': recommendExhibitors[0]?.productImageUrl[0] ? `<b>精選產品</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_0}</div>` : '<b>精選產品 - 沒有相關相片</b>',
      '{{PRODUCT_IMAGE_SC_0}}': recommendExhibitors[0]?.productImageUrl[0] ? `<b>精选产品</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_0}</div>` : '<b>精选产品 - 没有相关相片</b>',

      '{{COMPANY_LOGO_1}}': recommendExhibitors[1]?.companyLogo ? `<img src='${recommendExhibitors[1]?.companyLogo}' width='198' height='40'>` : '<div>&nbsp;</div>',
      '{{EXHIBITOR_NAME_1}}': `<b>${recommendExhibitors[1]?.exhibitorName}</b>`,
      '{{LOCATION_EN_1}}': recommendExhibitors[1]?.locationEn,
      '{{LOCATION_TC_1}}': recommendExhibitors[1]?.locationTc,
      '{{LOCATION_SC_1}}': recommendExhibitors[1]?.locationSc,
      '{{BOOTH_EN_1}}': recommendExhibitors[1]?.exhibitorType === 'Online' ? 'Online' : recommendExhibitors[1]?.booth.length !== 0 ? `Booth: ${recommendExhibitors[1]?.booth[0]}` : `&nbsp;`,
      '{{BOOTH_TC_1}}': recommendExhibitors[1]?.exhibitorType === 'Online' ? '線上' : recommendExhibitors[1]?.booth.length !== 0 ? `展位編號: ${recommendExhibitors[1]?.booth[0]}` : `&nbsp;`,
      '{{BOOTH_SC_1}}': recommendExhibitors[1]?.exhibitorType === 'Online' ? '线上' : recommendExhibitors[1]?.booth.length !== 0 ? `展位编号: ${recommendExhibitors[1]?.booth[0]}` : `&nbsp;`,
      '{{ZONE_PAVILIONS_EN_1}}': recommendExhibitors[1]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[1]?.zone.length !== 0 ? (recommendExhibitors[1]?.pavilions.length !== 0 ? recommendExhibitors[1]?.zone[0]?.zoneNameEn + ' | ' + recommendExhibitors[1]?.pavilions[0]?.pavilionNameEn : recommendExhibitors[1]?.zone[0]?.zoneNameEn) : '&nbsp;',
      '{{ZONE_PAVILIONS_TC_1}}': recommendExhibitors[1]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[1]?.zone.length !== 0 ? (recommendExhibitors[1]?.pavilions.length !== 0 ? recommendExhibitors[1]?.zone[0]?.zoneNameZhHant + ' | ' + recommendExhibitors[1]?.pavilions[0]?.pavilionNameZhHant : recommendExhibitors[1]?.zone[0]?.zoneNameZhHant) : '&nbsp;',
      '{{ZONE_PAVILIONS_SC_1}}': recommendExhibitors[1]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[1]?.zone.length !== 0 ? (recommendExhibitors[1]?.pavilions.length !== 0 ? recommendExhibitors[1]?.zone[0]?.zoneNameZhHans + ' | ' + recommendExhibitors[1]?.pavilions[0]?.pavilionNameZhHans : recommendExhibitors[1]?.zone[0]?.zoneNameZhHans) : '&nbsp;',
      '{{VIRTUAL_BOOTH_LABEL_1}}': recommendExhibitors[1]?.virtualBoothType === null ? '&nbsp;' : `<img src=${virtualBoothImageUrl} width='111' height='61'>`,
      '{{VERIFIED_LABEL_1}}': verifiedLabel_1,
      '{{PRODUCT_IMAGE_EN_1}}': recommendExhibitors[1]?.productImageUrl[0] ? `<b>Highlighted Products</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_1}</div>` : '<b>Highlighted Products - No photo available</b>',
      '{{PRODUCT_IMAGE_TC_1}}': recommendExhibitors[1]?.productImageUrl[0] ? `<b>精選產品</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_1}</div>` : '<b>精選產品 - 沒有相關相片</b>',
      '{{PRODUCT_IMAGE_SC_1}}': recommendExhibitors[1]?.productImageUrl[0] ? `<b>精选产品</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_1}</div>` : '<b>精选产品 - 没有相关相片</b>',

      '{{COMPANY_LOGO_2}}': recommendExhibitors[2]?.companyLogo ? `<img src='${recommendExhibitors[2]?.companyLogo}' width='198' height='40'>` : '<div>&nbsp;</div>',
      '{{EXHIBITOR_NAME_2}}': `<b>${recommendExhibitors[2]?.exhibitorName}</b>`,
      '{{LOCATION_EN_2}}': recommendExhibitors[2]?.locationEn,
      '{{LOCATION_TC_2}}': recommendExhibitors[2]?.locationTc,
      '{{LOCATION_SC_2}}': recommendExhibitors[2]?.locationSc,
      '{{BOOTH_EN_2}}': recommendExhibitors[2]?.exhibitorType === 'Online' ? 'Online' : recommendExhibitors[2]?.booth.length !== 0 ? `Booth: ${recommendExhibitors[2]?.booth[0]}` : `&nbsp;`,
      '{{BOOTH_TC_2}}': recommendExhibitors[2]?.exhibitorType === 'Online' ? '線上' : recommendExhibitors[2]?.booth.length !== 0 ? `展位編號: ${recommendExhibitors[2]?.booth[0]}` : `&nbsp;`,
      '{{BOOTH_SC_2}}': recommendExhibitors[2]?.exhibitorType === 'Online' ? '线上' : recommendExhibitors[2]?.booth.length !== 0 ? `展位编号: ${recommendExhibitors[2]?.booth[0]}` : `&nbsp;`,
      '{{ZONE_PAVILIONS_EN_2}}': recommendExhibitors[2]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[2]?.zone.length !== 0 ? (recommendExhibitors[2]?.pavilions.length !== 0 ? recommendExhibitors[2]?.zone[0]?.zoneNameEn + ' | ' + recommendExhibitors[2]?.pavilions[0]?.pavilionNameEn : recommendExhibitors[2]?.zone[0]?.zoneNameEn) : '&nbsp;',
      '{{ZONE_PAVILIONS_TC_2}}': recommendExhibitors[2]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[2]?.zone.length !== 0 ? (recommendExhibitors[2]?.pavilions.length !== 0 ? recommendExhibitors[2]?.zone[0]?.zoneNameZhHant + ' | ' + recommendExhibitors[2]?.pavilions[0]?.pavilionNameZhHant : recommendExhibitors[2]?.zone[0]?.zoneNameZhHant) : '&nbsp;',
      '{{ZONE_PAVILIONS_SC_2}}': recommendExhibitors[2]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[2]?.zone.length !== 0 ? (recommendExhibitors[2]?.pavilions.length !== 0 ? recommendExhibitors[2]?.zone[0]?.zoneNameZhHans + ' | ' + recommendExhibitors[2]?.pavilions[0]?.pavilionNameZhHans : recommendExhibitors[2]?.zone[0]?.zoneNameZhHans) : '&nbsp;',
      '{{VIRTUAL_BOOTH_LABEL_2}}': recommendExhibitors[2]?.virtualBoothType === null ? '&nbsp;' : `<img src=${virtualBoothImageUrl} width='111' height='61'>`,
      '{{VERIFIED_LABEL_2}}': verifiedLabel_2,
      '{{PRODUCT_IMAGE_EN_2}}': recommendExhibitors[2]?.productImageUrl[0] ? `<b>Highlighted Products</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_2}</div>` : '<b>Highlighted Products - No photo available</b>',
      '{{PRODUCT_IMAGE_TC_2}}': recommendExhibitors[2]?.productImageUrl[0] ? `<b>精選產品</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_2}</div>` : '<b>精選產品 - 沒有相關相片</b>',
      '{{PRODUCT_IMAGE_SC_2}}': recommendExhibitors[2]?.productImageUrl[0] ? `<b>精选产品</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_2}</div>` : '<b>精选产品 - 没有相关相片</b>',

      '{{COMPANY_LOGO_3}}': recommendExhibitors[3]?.companyLogo ? `<img src='${recommendExhibitors[3]?.companyLogo}' width='198' height='40'>` : '<div>&nbsp;</div>',
      '{{EXHIBITOR_NAME_3}}': `<b>${recommendExhibitors[3]?.exhibitorName}</b>`,
      '{{LOCATION_EN_3}}': recommendExhibitors[3]?.locationEn,
      '{{LOCATION_TC_3}}': recommendExhibitors[3]?.locationTc,
      '{{LOCATION_SC_3}}': recommendExhibitors[3]?.locationSc,
      '{{BOOTH_EN_3}}': recommendExhibitors[3]?.exhibitorType === 'Online' ? 'Online' : recommendExhibitors[3]?.booth.length !== 0 ? `Booth: ${recommendExhibitors[3]?.booth[0]}` : `&nbsp;`,
      '{{BOOTH_TC_3}}': recommendExhibitors[3]?.exhibitorType === 'Online' ? '線上' : recommendExhibitors[3]?.booth.length !== 0 ? `展位編號: ${recommendExhibitors[3]?.booth[0]}` : `&nbsp;`,
      '{{BOOTH_SC_3}}': recommendExhibitors[3]?.exhibitorType === 'Online' ? '线上' : recommendExhibitors[3]?.booth.length !== 0 ? `展位编号: ${recommendExhibitors[3]?.booth[0]}` : `&nbsp;`,
      '{{ZONE_PAVILIONS_EN_3}}': recommendExhibitors[3]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[3]?.zone.length !== 0 ? (recommendExhibitors[3]?.pavilions.length !== 0 ? recommendExhibitors[3]?.zone[0]?.zoneNameEn + ' | ' + recommendExhibitors[3]?.pavilions[0]?.pavilionNameEn : recommendExhibitors[3]?.zone[0]?.zoneNameEn) : '&nbsp;',
      '{{ZONE_PAVILIONS_TC_3}}': recommendExhibitors[3]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[3]?.zone.length !== 0 ? (recommendExhibitors[3]?.pavilions.length !== 0 ? recommendExhibitors[3]?.zone[0]?.zoneNameZhHant + ' | ' + recommendExhibitors[3]?.pavilions[0]?.pavilionNameZhHant : recommendExhibitors[3]?.zone[0]?.zoneNameZhHant) : '&nbsp;',
      '{{ZONE_PAVILIONS_SC_3}}': recommendExhibitors[3]?.exhibitorType === 'Online' ? '&nbsp;' : recommendExhibitors[3]?.zone.length !== 0 ? (recommendExhibitors[3]?.pavilions.length !== 0 ? recommendExhibitors[3]?.zone[0]?.zoneNameZhHans + ' | ' + recommendExhibitors[3]?.pavilions[0]?.pavilionNameZhHans : recommendExhibitors[3]?.zone[0]?.zoneNameZhHans) : '&nbsp;',
      '{{VIRTUAL_BOOTH_LABEL_3}}': recommendExhibitors[3]?.virtualBoothType === null ? '&nbsp;' : `<img src=${virtualBoothImageUrl} width='111' height='61'>`,
      '{{VERIFIED_LABEL_3}}': verifiedLabel_3,
      '{{PRODUCT_IMAGE_EN_3}}': recommendExhibitors[3]?.productImageUrl[0] ? `<b>Highlighted Products</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_3}</div>` : '<b>Highlighted Products - No photo available</b>',
      '{{PRODUCT_IMAGE_TC_3}}': recommendExhibitors[3]?.productImageUrl[0] ? `<b>精選產品</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_3}</div>` : '<b>精選產品 - 沒有相關相片</b>',
      '{{PRODUCT_IMAGE_SC_3}}': recommendExhibitors[3]?.productImageUrl[0] ? `<b>精选产品</b><p>&nbsp;</p><div style='display: flex;'>${productImageUrl_3}</div>` : '<b>精选产品 - 没有相关相片</b>',
    }
  }

  public async prepareDynamicContentForKickOFF(userDetailData: Record<string, any>, templateId: number, fairData: Record<string, any>, recommendExhibitors: any): Promise<any> {

    switch(templateId) {
      case NotificationTemplatesId.C2M_KICK_OFF_EXHIBITOR:
        return {
          'EXHIBITOR_NAME': `${userDetailData[0].firstName} ${userDetailData[0].lastName}`,
          'EXHIBITOR_COMPANY_NAME': userDetailData[0].companyName,
          'FAIR_LONG_NAME_EN': `${fairData.fairDispalyName.en}`,
          'FAIR_LONG_NAME_TC': `${fairData.fairDispalyName.tc}`,
          'FAIR_LONG_NAME_SC': `${fairData.fairDispalyName.sc}`,
          'FAIR_SHORT_NAME_EN': `${fairData.fairShortName.en}`,
          'FAIR_SHORT_NAME_TC': `${fairData.fairShortName.tc}`,
          'FAIR_SHORT_NAME_SC': `${fairData.fairShortName.sc}`,
          'LOGIN_PAGE_EN': `<a href=${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/en/c2m-meeting/recommendation?tab=prospectForYouExhibitor>`,
          'LOGIN_PAGE_EN_2': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/en/c2m-meeting</a>`,
          'LOGIN_PAGE_EN_3': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/en/c2m-meeting`,
          'LOGIN_PAGE_TC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/tc/c2m-meeting/recommendation?tab=prospectForYouExhibitor>`,
          'LOGIN_PAGE_TC_2': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/tc/c2m-meeting</a>`,
          'LOGIN_PAGE_TC_3': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/tc/c2m-meeting`,
          'LOGIN_PAGE_SC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/sc/c2m-meeting/recommendation?tab=prospectForYouExhibitor>`,
          'LOGIN_PAGE_SC_2': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/sc/c2m-meeting</a>`,
          'LOGIN_PAGE_SC_3': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/sc/c2m-meeting`,
          'PHYSICAL_FAIR_DAY_START': moment.tz(fairData.c2mStartDatetime, 'YYYY-MM-DD HH:mm').utc().format('YYYY-MM-DD'),
          'C2M_FAIR_DAY_END':  moment.tz(fairData.c2mEndDatetime, 'YYYY-MM-DD HH:mm').utc().format('YYYY-MM-DD'),
        };
      case NotificationTemplatesId.C2M_KICK_OFF_BUYER:
        // https://drive.google.com/uc?id=1ADQo2U91moFZBwzfm0r1VcMQI9EkOq62
        const locationImageUrl = `${this.configService.get<string>('s3.apContentDomain')}/location.png`
        // https://drive.google.com/uc?id=1QO97ED0779UQX7QMcKJUMoIw0mw81UbI
        const virtualBoothImageUrl = `${this.configService.get<string>('s3.apContentDomain')}/virtual-booth.png`
        // https://drive.google.com/uc?id=1spob3mKpP59zcL0vTmC9fGEtx2j9w0vm
        const bronzeImageUrl = `${this.configService.get<string>('s3.apContentDomain')}/bronze.png`
        // https://drive.google.com/uc?id=1yzX7i2Isa-rCeVDfq50nkb0Xan5mb4az
        const silverImageUrl = `${this.configService.get<string>('s3.apContentDomain')}/silver.png`
        // https://drive.google.com/uc?id=1S2tjTEnBI-zJWSdkvhiyPPKnGfWC5PnA
        const goldImageUrl = `${this.configService.get<string>('s3.apContentDomain')}/gold.png`

        let language = userDetailData[0].preferredLanguage.toUpperCase() || 'EN'        
        const cardNumber: number = recommendExhibitors.length;

        const style =`
          <link href='https://fonts.googleapis.com/css?family=Roboto Condensed' rel='stylesheet'>
          <style>
              .card {
                  color: black;
                  background-color: rgb(248, 248, 248);
                  font-family: 'Roboto', sans-serif;
                  font-size: 18px;
                  padding-left: 10.5px;
              }

              .companyLogo {
                  padding-top: 20px;
              }

              .exhibitorName {
                  font-size: 22px;
                  padding-right: 10.5px;
                  padding-bottom: 7px;
              }

              .location {
                  color: rgb(74, 82, 94);
              }

              .product {
                  padding-top: 15px;
              }
          </style>
        `

        let newCard: string = '';
        let card0: string;
        let card1: string;
        let card2: string;
        let card3: string;
        let card4: string;

        card0 = `<p>&nbsp;</p>`;
        card1 = `
        <div class='card' style='width:402px; height:625px;'>
          <p class='companyLogo'>{{Company_Logo_0}}</p>
          <div class='exhibitorName' style='width:402px;'><a>{{Exhibitor_Name_0}}</a></div>
          <div style='display: flex;'>
              <div class='location'><img src=${locationImageUrl}
                      width='18' height='18'>{{Location_${language}_0}}<div>{{BOOTH_${language}_0}}</div>
                  <div>{{ZONE_PAVILIONS_${language}_0}}</div>
              </div>
              <div style='width:35px;'>&nbsp;</div>
              <div>{{VIRTUAL_BOOTH_LABEL_0}}</div>
              <div>{{VERIFIED_LABEL_0}}</div>
          </div>
          <div class='product'>{{PRODUCT_IMAGE_${language}_0}}</div>
        </div>
        `
        card2 = `
        <div class='card' style='width:402px; height:625px;'>
            <p class='companyLogo'>{{Company_Logo_0}}</p>
            <div class='exhibitorName' style='width:402px;'><a>{{Exhibitor_Name_0}}</a></div>
            <div style='display: flex;'>
                <div class='location'><img src=${locationImageUrl}
                        width='18' height='18'>{{Location_${language}_0}}<div>{{BOOTH_${language}_0}}</div>
                    <div>{{ZONE_PAVILIONS_${language}_0}}</div>
                </div>
                <div style='width:35px;'>&nbsp;</div>
                <div>{{VIRTUAL_BOOTH_LABEL_0}}</div>
                <div>{{VERIFIED_LABEL_0}}</div>
            </div>
            <div class='product'>{{PRODUCT_IMAGE_${language}_0}}</div>
        </div>
        <div style='width:21px;'>&nbsp;</div>
        <div class='card' style='width:402px; height:625px;'>
            <p class='companyLogo'>{{Company_Logo_1}}</p>
            <div class='exhibitorName' style='width:402px;'><a>{{Exhibitor_Name_1}}</a></div>
            <div style='display: flex;'>
                <div class='location'><img src=${locationImageUrl}
                        width='18' height='18'>{{Location_${language}_1}}<div>{{BOOTH_${language}_1}}</div>
                    <div>{{ZONE_PAVILIONS_${language}_1}}</div>
                </div>
                <div style='width:35px;'>&nbsp;</div>
                <div>{{VIRTUAL_BOOTH_LABEL_1}}</div>
                <div>{{VERIFIED_LABEL_1}}</div>
            </div>
            <div class='product'>{{PRODUCT_IMAGE_${language}_1}}</div>
        </div>
        `
        card3 = `
          <div class='card' style='width:402px; height:625px;'>
              <p class='companyLogo'>{{Company_Logo_0}}</p>
              <div class='exhibitorName' style='width:402px;'><a>{{Exhibitor_Name_0}}</a></div>
              <div style='display: flex;'>
                  <div class='location'><img src=${locationImageUrl}
                          width='18' height='18'>{{Location_${language}_0}}<div>{{BOOTH_${language}_0}}</div>
                      <div>{{ZONE_PAVILIONS_${language}_0}}</div>
                  </div>
                  <div style='width:35px;'>&nbsp;</div>
                  <div>{{VIRTUAL_BOOTH_LABEL_0}}</div>
                  <div>{{VERIFIED_LABEL_0}}</div>
              </div>
              <div class='product'>{{PRODUCT_IMAGE_${language}_0}}</div>
          </div>
          <div style='width:21px;'>&nbsp;</div>
          <div class='card' style='width:402px; height:625px;'>
              <p class='companyLogo'>{{Company_Logo_1}}</p>
              <div class='exhibitorName' style='width:402px;'><a>{{Exhibitor_Name_1}}</a></div>
              <div style='display: flex;'>
                  <div class='location'><img src=${locationImageUrl}
                          width='18' height='18'>{{Location_${language}_1}}<div>{{BOOTH_${language}_1}}</div>
                      <div>{{ZONE_PAVILIONS_${language}_1}}</div>
                  </div>
                  <div style='width:35px;'>&nbsp;</div>
                  <div>{{VIRTUAL_BOOTH_LABEL_1}}</div>
                  <div>{{VERIFIED_LABEL_1}}</div>
              </div>
              <div class='product'>{{PRODUCT_IMAGE_${language}_1}}</div>
          </div>
          </div>
          <p>&nbsp;</p>
          <div style='display: flex;'>
          <div class='card' style='width:402px; height:625px'>
              <p class='companyLogo'>{{Company_Logo_2}}</p>
              <div class='exhibitorName' style='width:402px;'><a>{{Exhibitor_Name_2}}</a></div>
              <div style='display: flex;'>
                  <div class='location'><img src=${locationImageUrl}
                          width='18' height='18'>{{Location_${language}_2}}<div>{{BOOTH_${language}_2}}</div>
                      <div>{{ZONE_PAVILIONS_${language}_2}}</div>
                  </div>
                  <div style='width:35px;'>&nbsp;</div>
                  <div>{{VIRTUAL_BOOTH_LABEL_2}}</div>
                  <div>{{VERIFIED_LABEL_2}}</div>
              </div>
              <div class='product'>{{PRODUCT_IMAGE_${language}_2}}</div>
          </div>
        `
        card4 = `
          <div class='card' style='width:402px; height:625px;'>
              <p class='companyLogo'>{{Company_Logo_0}}</p>
              <div class='exhibitorName' style='width:402px;'><a>{{Exhibitor_Name_0}}</a></div>
              <div style='display: flex;'>
                  <div class='location'><img src=${locationImageUrl}
                          width='18' height='18'>{{Location_${language}_0}}<div>{{BOOTH_${language}_0}}</div>
                      <div>{{ZONE_PAVILIONS_${language}_0}}</div>
                  </div>
                  <div style='width:35px;'>&nbsp;</div>
                  <div>{{VIRTUAL_BOOTH_LABEL_0}}</div>
                  <div>{{VERIFIED_LABEL_0}}</div>
              </div>
              <div class='product'>{{PRODUCT_IMAGE_${language}_0}}</div>
          </div>
          <div style='width:21px;'>&nbsp;</div>
          <div class='card' style='width:402px; height:625px;'>
              <p class='companyLogo'>{{Company_Logo_1}}</p>
              <div class='exhibitorName' style='width:402px;'><a>{{Exhibitor_Name_1}}</a></div>
              <div style='display: flex;'>
                  <div class='location'><img src=${locationImageUrl}
                          width='18' height='18'>{{Location_${language}_1}}<div>{{BOOTH_${language}_1}}</div>
                      <div>{{ZONE_PAVILIONS_${language}_1}}</div>
                  </div>
                  <div style='width:35px;'>&nbsp;</div>
                  <div>{{VIRTUAL_BOOTH_LABEL_1}}</div>
                  <div>{{VERIFIED_LABEL_1}}</div>
              </div>
              <div class='product'>{{PRODUCT_IMAGE_${language}_1}}</div>
          </div>
          </div>
          <p>&nbsp;</p>
          <div style='display: flex;'>
          <div class='card' style='width:402px; height:625px'>
              <p class='companyLogo'>{{Company_Logo_2}}</p>
              <div class='exhibitorName' style='width:402px;'><a>{{Exhibitor_Name_2}}</a></div>
              <div style='display: flex;'>
                  <div class='location'><img src=${locationImageUrl}
                          width='18' height='18'>{{Location_${language}_2}}<div>{{BOOTH_${language}_2}}</div>
                      <div>{{ZONE_PAVILIONS_${language}_2}}</div>
                  </div>
                  <div style='width:35px;'>&nbsp;</div>
                  <div>{{VIRTUAL_BOOTH_LABEL_2}}</div>
                  <div>{{VERIFIED_LABEL_2}}</div>
              </div>
              <div class='product'>{{PRODUCT_IMAGE_${language}_2}}</div>
          </div>
          <div style='width:21px;'>&nbsp;</div>
          <div class='card' style='width:402px; height:625px'>
              <p class='companyLogo'>{{Company_Logo_3}}</p>
              <div class='exhibitorName' style='width:402px;'><a>{{Exhibitor_Name_3}}</a></div>
              <div style='display: flex;'>
                  <div class='location'><img src=${locationImageUrl}
                          width='18' height='18'>{{Location_${language}_3}}<div>{{BOOTH_${language}_3}}</div>
                      <div>{{ZONE_PAVILIONS_${language}_3}}</div>
                  </div>
                  <div style='width:35px;'>&nbsp;</div>
                  <div>{{VIRTUAL_BOOTH_LABEL_3}}</div>
                  <div>{{VERIFIED_LABEL_3}}</div>
              </div>
              <div class='product'>{{PRODUCT_IMAGE_${language}_3}}</div>
          </div>
        `

        let productImageUrl_0: string = '';
        let productImageUrl_1: string = '';
        let productImageUrl_2: string = '';
        let productImageUrl_3: string = '';
        let productImageUrlTemp = `<img src='{{PRODUCT_IMAGE}}' width='97';height='97'><div style='width:21px;'>&nbsp;</div>`

        let newImageTag
        for (let i = 0; i < recommendExhibitors.length; i++) {
          for (let j = 0; j < recommendExhibitors[i].productImageUrl.length; j++) {
            if (j < 3) {
              // prepare table data
              const preparedDynamicWordsForImage = this.prepareDynamicContentForProductImage(recommendExhibitors[i].productImageUrl[j]);            
              // replace url to the html
              newImageTag = this.replaceDynamicValueForRow(productImageUrlTemp, preparedDynamicWordsForImage)

              // append new url to the html
              if (i === 0) {
                productImageUrl_0 = productImageUrl_0 + newImageTag;
              } else if (i === 1) {
                productImageUrl_1 = productImageUrl_1 + newImageTag;
              } else if (i === 2) {
                productImageUrl_2 = productImageUrl_2 + newImageTag;
              } else {
                productImageUrl_3 = productImageUrl_3 + newImageTag;
              }
            }
          }
        }

        // 'BRONZE'
        // 'SILVER'
        // 'GOLD'
        let verifiedLabel_0: string = '';
        let verifiedLabel_1: string = '';
        let verifiedLabel_2: string = '';
        let verifiedLabel_3: string = '';
        for (let i = 0; i < recommendExhibitors.length; i++) {
          if (i === 0) {
            if (recommendExhibitors[i].supplierVerifiedLabel === 'GOLD') {
              verifiedLabel_0 = `<img src= ${goldImageUrl} style='padding-right:21px width='111' height='61'>`
            } else if (recommendExhibitors[i].supplierVerifiedLabel === 'SILVER') {
              verifiedLabel_0 = `<img src= ${silverImageUrl} style='padding-right:21px width='111' height='61'>`
            } else if (recommendExhibitors[i].supplierVerifiedLabel === 'BRONZE') {
              verifiedLabel_0 = `<img src= ${bronzeImageUrl} style='padding-right:21px width='111' height='61'>`
            } else {
              verifiedLabel_0 = '&nbsp;'
            }
          } else if (i === 1) {
            if (recommendExhibitors[i].supplierVerifiedLabel === 'GOLD') {
              verifiedLabel_1 = `<img src= ${goldImageUrl} style='padding-right:21px width='111' height='61'>`
            } else if (recommendExhibitors[i].supplierVerifiedLabel === 'SILVER') {
              verifiedLabel_1 = `<img src= ${silverImageUrl} style='padding-right:21px width='111' height='61'>`
            } else if (recommendExhibitors[i].supplierVerifiedLabel === 'BRONZE') {
              verifiedLabel_1 = `<img src= ${bronzeImageUrl} style='padding-right:21px width='111' height='61'>`
            } else {
              verifiedLabel_1 = '&nbsp;'
            }
          } else if (i === 2) {
            if (recommendExhibitors[i].supplierVerifiedLabel === 'GOLD') {
              verifiedLabel_2 = `<img src= ${goldImageUrl} style='padding-right:21px width='111' height='61'>`
            } else if (recommendExhibitors[i].supplierVerifiedLabel === 'SILVER') {
              verifiedLabel_2 = `<img src= ${silverImageUrl} style='padding-right:21px width='111' height='61'>`
            } else if (recommendExhibitors[i].supplierVerifiedLabel === 'BRONZE') {
              verifiedLabel_2 = `<img src= ${bronzeImageUrl} style='padding-right:21px width='111' height='61'>`
            } else {
              verifiedLabel_2 = '&nbsp;'
            }
          } else {
            if (recommendExhibitors[i].supplierVerifiedLabel === 'GOLD') {
              verifiedLabel_3 = `<img src= ${goldImageUrl} style='padding-right:21px width='111' height='61'>`
            } else if (recommendExhibitors[i].supplierVerifiedLabel === 'SILVER') {
              verifiedLabel_3 = `<img src= ${silverImageUrl} style='padding-right:21px width='111' height='61'>`
            } else if (recommendExhibitors[i].supplierVerifiedLabel === 'BRONZE') {
              verifiedLabel_3 = `<img src= ${bronzeImageUrl} style='padding-right:21px width='111' height='61'>`
            } else {
              verifiedLabel_3 = '&nbsp;'
            }
          }
        }

      // prepare card data
      const preparedDynamicWordsForTable = this.prepareDynamicContentForCard(
        recommendExhibitors,
        productImageUrl_0,
        productImageUrl_1,
        productImageUrl_2,
        productImageUrl_3,
        verifiedLabel_0,
        verifiedLabel_1,
        verifiedLabel_2,
        verifiedLabel_3,
        virtualBoothImageUrl,
      );

      if (cardNumber === 0) {
        newCard = card0;
      } else if (cardNumber === 1) {
        newCard = card1;
      } else if (cardNumber === 2) {
        newCard = card2;
      } else if (cardNumber === 3) {
        newCard = card3;
      } else if (cardNumber === 4) {
        newCard = card4;
      }

      // replace card data to the {{CARD}}
      newCard = this.replaceDynamicValueForRow(newCard, preparedDynamicWordsForTable)

      return {
        'STYLE': cardNumber === 0 ? `<p>&nbsp;</p>` : style,
        'CARD': newCard,
        'BUYER_NAME': `${userDetailData[0].firstName} ${userDetailData[0].lastName}`,
        'BUYER_COMPANY_NAME': userDetailData[0].companyName,
        'FAIR_LONG_NAME_EN': `${fairData.fairDispalyName.en}`,
        'FAIR_LONG_NAME_TC': `${fairData.fairDispalyName.tc}`,
        'FAIR_LONG_NAME_SC': `${fairData.fairDispalyName.sc}`,
        'FAIR_SHORT_NAME_EN': `${fairData.fairShortName.en}`,
        'FAIR_SHORT_NAME_TC': `${fairData.fairShortName.tc}`,
        'FAIR_SHORT_NAME_SC': `${fairData.fairShortName.sc}`,
        'LOGIN_PAGE_EN': `<a href=${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/en/c2m-meeting/recommendation?tab=prospectForYouBuyer>`,
        'LOGIN_PAGE_EN_2': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/en/c2m-meeting</a>`,
        'LOGIN_PAGE_EN_3': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/en/c2m-meeting`,
        'LOGIN_PAGE_TC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/tc/c2m-meeting/recommendation?tab=prospectForYouBuyer>`,
        'LOGIN_PAGE_TC_2': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/tc/c2m-meeting</a>`,
        'LOGIN_PAGE_TC_3': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/tc/c2m-meeting`,
        'LOGIN_PAGE_SC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/sc/c2m-meeting/recommendation?tab=prospectForYouBuyer>`,
        'LOGIN_PAGE_SC_2': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/sc/c2m-meeting</a>`,
        'LOGIN_PAGE_SC_3': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/sc/c2m-meeting`,
        'PHYSICAL_FAIR_DAY_START': moment.tz(fairData.c2mStartDatetime, 'YYYY-MM-DD HH:mm').utc().format('YYYY-MM-DD'),
        'C2M_FAIR_DAY_END':  moment.tz(fairData.c2mEndDatetime, 'YYYY-MM-DD HH:mm').utc().format('YYYY-MM-DD'),
        'HERE_PROSPECTFORYOU_EN': `<a href=${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/en/c2m-meeting/recommendation?tab=prospectForYouBuyer>`,
        'HERE_PROSPECTFORYOU_EN_2': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/en/c2m-meeting/recommendation?tab=prospectForYouBuyer</a>`,
        'HERE_PROSPECTFORYOU_TC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/tc/c2m-meeting/recommendation?tab=prospectForYouBuyer>`,
        'HERE_PROSPECTFORYOU_TC_2': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/tc/c2m-meeting/recommendation?tab=prospectForYouBuyer</a>`,
        'HERE_PROSPECTFORYOU_SC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/sc/c2m-meeting/recommendation?tab=prospectForYouBuyer>`,
        'HERE_PROSPECTFORYOU_SC_2': `${this.configService.get<string>('vepSite.domain')}event/${userDetailData[0].fairCode}/sc/c2m-meeting/recommendation?tab=prospectForYouBuyer</a>`,
        'PHYSICAL_FAIR_DAY_START_2': moment.tz(fairData.c2mStartDatetime, 'YYYY-MM-DD HH:mm').utc().format('YYYY-MM-DD'),
        'C2M_FAIR_DAY_END_2':  moment.tz(fairData.c2mEndDatetime, 'YYYY-MM-DD HH:mm').utc().format('YYYY-MM-DD'),
      };
    }
  }

  public prepareDynamicContentForSeminarTable(seminarRecord: Record<string, any>, templateId: number, userTimezone: string, seminarNumber: number): Record<string, any> {
    const tempSeminarType = seminarRecord?.seminarType;
    let seminarTypeEn
    let seminarTypeTc
    let seminarTypeSc
    if (tempSeminarType === 'ON') {
      seminarTypeEn = 'ONLINE';
      seminarTypeTc = '線上';
      seminarTypeSc = '在线';
    } else if (tempSeminarType === 'PH') {
      seminarTypeEn = 'PHYSICAL'
      seminarTypeTc = '面交'
      seminarTypeSc = '面交'
    } else if (tempSeminarType === 'HY') {
      seminarTypeEn = 'HYBRID';
      seminarTypeTc = '線上及實體研討會';
      seminarTypeSc = '线上及实体研讨会';
    } else {
      seminarTypeEn = 'All';
      seminarTypeTc = '全部';
      seminarTypeSc = '全部';
    }

    let userSeminarDateWithUserTZ = moment(seminarRecord?.seminarStartTime).tz(userTimezone);;
    let seminarName = seminarRecord?.seminarName;
    let seminarLocation = seminarRecord?.seminarLocation;

    switch (templateId){
      case NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS:
        return {
          '{{NO}}': seminarNumber,
          '{{DATE}}': userSeminarDateWithUserTZ.format('DD-MM-YYYY'),
          '{{TIME}}': userSeminarDateWithUserTZ.format('HH:mm') + ` (UTC/GMT${moment.tz(moment(), userTimezone).format('Z').replace(/:00/, '')})`,
          '{{SEMINAR_TYPE_EN}}': seminarTypeEn,
          '{{SEMINAR_TYPE_TC}}': seminarTypeTc,
          '{{SEMINAR_TYPE_SC}}': seminarTypeSc,
          '{{SEMINAR_NAME}}': seminarName,
          '{{SEMINAR_LOCATION}}': seminarLocation
        };

      case NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER:
        return {
          '{{NO}}': seminarNumber,
          '{{DATE}}': userSeminarDateWithUserTZ.format('DD-MM-YYYY'),
          '{{TIME}}': userSeminarDateWithUserTZ.format('HH:mm') + ` (UTC/GMT${moment.tz(moment(), userTimezone).format('Z').replace(/:00/, '')})`,
          '{{SEMINAR_TYPE_EN}}': seminarTypeEn,
          '{{SEMINAR_TYPE_TC}}': seminarTypeTc,
          '{{SEMINAR_TYPE_SC}}': seminarTypeSc,
          '{{SEMINAR_NAME}}': seminarName,
          '{{SEMINAR_LOCATION}}': seminarLocation
        };

      case NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER:
        return {
          '{{NO}}': seminarNumber,
          '{{DATE}}': userSeminarDateWithUserTZ.format('DD-MM-YYYY'),
          '{{TIME}}': userSeminarDateWithUserTZ.format('HH:mm') + ` (UTC/GMT${moment.tz(moment(), userTimezone).format('Z').replace(/:00/, '')})`,
          '{{SEMINAR_TYPE_EN}}': seminarTypeEn,
          '{{SEMINAR_TYPE_TC}}': seminarTypeTc,
          '{{SEMINAR_TYPE_SC}}': seminarTypeSc,
          '{{SEMINAR_NAME}}': seminarName,
          '{{SEMINAR_LOCATION}}': seminarLocation
        };

      default:
        return {};
    }
  }

  public async prepareDynamicContentForSeminar(userData: Record<string, any>, seminarsDataByTargetUser: Record<string, any>, templateId: number, fairCode: string, fairData: Record<string, any>, seminarSummaryStartRange?: any, seminarSummaryEndRange?: any): Promise<any> {
    // 1. Get user profile base on any one of userData
    // to - do: userRole get from seminarRegistration table
    let userRole = 'BUYER';
    let userPreferredLanguage = seminarsDataByTargetUser[0].preferredLanguage;
    let userFirstName = seminarsDataByTargetUser[0]?.firstName;
    let userLastName = seminarsDataByTargetUser[0]?.lastName;
    let userFairLongName = fairData?.Fair_long_name_EN;

    let userTimezone = '';
    if (userRole === ReceiverRole.BUYER) {
      const buyerInfoResult = await this.buyerService.getTimezoneAndPreferredLang(fairCode, userData?.userId, seminarsDataByTargetUser[0]?.userEmail);
      userTimezone = buyerInfoResult?.data?.userTimezone;
    } else {
      const exhibitorInfoResult = await this.apiExhibitorService.getExhibitorProfile(seminarsDataByTargetUser[0]?.userEmail);
      userTimezone = exhibitorInfoResult?.data?.data?.userTimezone;
    }
    if(!userTimezone) {
      userTimezone = 'Asia/Hong_Kong';
    }

    console.log(userTimezone)

    // 2. Loop seminarsDataByTargetUser to get seminar details
    let seminarName = '';
    for (let i = 0; i < seminarsDataByTargetUser.length; i++) {
      let temp;
      // if the seminar list only has 1 record OR the last record, then no need add ','
      if (seminarsDataByTargetUser.length === 1 || i === seminarsDataByTargetUser.length - 1) {
        temp = seminarsDataByTargetUser[i].seminarName;
      } else {
        temp = seminarsDataByTargetUser[i].seminarName + ', '
      }
      seminarName = seminarName + temp;
    }

    const tdStyle = 'style="border: 1px solid #dddddd; text-align: left; padding: 8px;"'
    let emailTableHeader: string
    let emailTableRow: string
    let webNotiSeminarList: string
    if (userPreferredLanguage === 'tc') {
      emailTableHeader =
      `<tr>
      <td ${tdStyle}><div><strong>序號</strong></div></td>
      <td ${tdStyle}><div><strong>日期</strong></div></td>
      <td ${tdStyle}><div><strong>時間</strong></div></td>
      <td ${tdStyle}><div><strong>活動種類</strong></div></td>
      <td ${tdStyle}><div><strong>活動名稱</strong></div></td>
      <td ${tdStyle}><div><strong>活動地點</strong></div></td>
      </tr>`;

      emailTableRow =
      `<tr>
      <td ${tdStyle}><div><br>{{NO}}<br></div></td>
      <td ${tdStyle}><div><br>{{DATE}}<br></div></td>
      <td ${tdStyle}><div><br>{{TIME}}<br></div></td>
      <td ${tdStyle}><div><br>{{SEMINAR_TYPE_TC}}<br></div></td>
      <td ${tdStyle}><div><br>​{{SEMINAR_NAME}}<br></div></td>
      <td ${tdStyle}><div><br>​{{SEMINAR_LOCATION}}<br></div></td>
      </tr>`;

      webNotiSeminarList = '{{DATE}} {{TIME}} 舉行「{{SEMINAR_NAME}}」';
 
    } else if (userPreferredLanguage === 'sc') {
      emailTableHeader =
      `<tr>
      <td ${tdStyle}><div><strong>序号</strong></div></td>
      <td ${tdStyle}><div><strong>日期</strong></div></td>
      <td ${tdStyle}><div><strong>时间</strong></div></td>
      <td ${tdStyle}><div><strong>活动种类</strong></div></td>
      <td ${tdStyle}><div><strong>活动名称</strong></div></td>
      <td ${tdStyle}><div><strong>活动地点</strong></div></td>
      </tr>`;

      emailTableRow =
      `<tr>
      <td ${tdStyle}><div><br>{{NO}}<br></div></td>
      <td ${tdStyle}><div><br>{{DATE}}<br></div></td>
      <td ${tdStyle}><div><br>{{TIME}}<br></div></td>
      <td ${tdStyle}><div><br>{{SEMINAR_TYPE_SC}}<br></div></td>
      <td ${tdStyle}><div><br>​{{SEMINAR_NAME}}<br></div></td>
      <td ${tdStyle}><div><br>​{{SEMINAR_LOCATION}}<br></div></td>
      </tr>`;

      webNotiSeminarList = '{{DATE}} {{TIME}} 举行的「{{SEMINAR_NAME}}」';

    } else {
      emailTableHeader =
      `<tr>
      <td ${tdStyle}><div><strong>No.</strong></div></td>
      <td ${tdStyle}><div><strong>Date</strong></div></td>
      <td ${tdStyle}><div><strong>Time</strong></div></td>
      <td ${tdStyle}><div><strong>Seminar Type</strong></div></td>
      <td ${tdStyle}><div><strong>Seminar Name</strong></div></td>
      <td ${tdStyle}><div><strong>Seminar Location</strong></div></td>
      </tr>`;

      emailTableRow =
      `<tr>
      <td ${tdStyle}><div><br>{{NO}}<br></div></td>
      <td ${tdStyle}><div><br>{{DATE}}<br></div></td>
      <td ${tdStyle}><div><br>{{TIME}}<br></div></td>
      <td ${tdStyle}><div><br>{{SEMINAR_TYPE_EN}}<br></div></td>
      <td ${tdStyle}><div><br>​{{SEMINAR_NAME}}<br></div></td>
      <td ${tdStyle}><div><br>​{{SEMINAR_LOCATION}}<br></div></td>
      </tr>`;

      webNotiSeminarList = '{{SEMINAR_NAME}} on {{DATE}} at {{TIME}}';

    }

    let allEmailTableRow: string = '';
    let emailTable;
    let newEmailTableRow;

    let allWebNotiSeminarList: string = '';
    let seminarList;
    let newWebNotiSeminarList

    // get data base on each of seminar data
    let semianrNumber: number = 0;
    seminarsDataByTargetUser.forEach((semianrRecord: any, index: number) => { 
      semianrNumber = semianrNumber + 1;
      // prepare table data
      const preparedDynamicWordsForTable = this.prepareDynamicContentForSeminarTable(semianrRecord, templateId, userTimezone, semianrNumber);

      // replace data to the table
      newEmailTableRow = this.replaceDynamicValueForRow(emailTableRow, preparedDynamicWordsForTable)
      // append new row to the table
      allEmailTableRow = allEmailTableRow + newEmailTableRow;
      console.log(allEmailTableRow)

      // replace data to the list
      newWebNotiSeminarList = this.replaceDynamicValueForRow(webNotiSeminarList, preparedDynamicWordsForTable)
      if (index !== seminarsDataByTargetUser.length - 1) {
        // append new record to the list
        allWebNotiSeminarList = allWebNotiSeminarList + newWebNotiSeminarList + ', '
      } else {
        allWebNotiSeminarList = allWebNotiSeminarList + newWebNotiSeminarList
      }

      console.log(allWebNotiSeminarList)
    })
    emailTable ='<table>' + emailTableHeader + allEmailTableRow + '</table>'
    console.log(emailTable);

    seminarList =  allWebNotiSeminarList
    console.log(seminarList)
    
    switch(templateId) {
      case NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS:
        return {
          'LIST': seminarList,
          'USER_NAME':`${userFirstName} ${userLastName}`,
          'TABLE': emailTable,
          'LINK_MYACCOUNT_SEMINAR_EN': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/en/c2m-meeting/seminar?tab=upcoming>HERE</a>`,
          'LINK_MYACCOUNT_SEMINAR_TC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/tc/c2m-meeting/seminar?tab=upcoming>此處</a>`,
          'LINK_MYACCOUNT_SEMINAR_SC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/sc/c2m-meeting/seminar?tab=upcoming>此处</a>`
        }
      case NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER:
        return {
          'SEMINAR_NAME_EN': seminarName,
          'SEMINAR_NAME_TC': seminarName,
          'SEMINAR_NAME_SC': seminarName,
          'USER_NAME':`${userFirstName} ${userLastName}`,
          'FAIR_LONG_NAME_EN': userFairLongName,
          'TABLE': emailTable,
          'LINK_MYACCOUNT_SEMINAR_EN': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/en/c2m-meeting/seminar?tab=upcoming>HERE</a>`,
          'LINK_MYACCOUNT_SEMINAR_TC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/tc/c2m-meeting/seminar?tab=upcoming>此處</a>`,
          'LINK_MYACCOUNT_SEMINAR_SC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/sc/c2m-meeting/seminar?tab=upcoming>此处</a>`,
          'SEMINAR_SUMMARY_START_RANGE': seminarSummaryStartRange.format('DD-MM-YYYY'),
          'SEMINAR_SUMMARY_END_RANGE': seminarSummaryEndRange.format('DD-MM-YYYY'),
        }
      case NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER:
        return {
          'X': seminarSummaryEndRange.diff(seminarSummaryStartRange, 'minutes'),
          'SEMINAR_NAME_EN': seminarName,
          'SEMINAR_NAME_TC': seminarName,
          'SEMINAR_NAME_SC': seminarName,
          'USER_NAME':`${userFirstName} ${userLastName}`,
          'TABLE': emailTable,
          'LINK_MYACCOUNT_SEMINAR_EN': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/en/c2m-meeting/seminar?tab=upcoming>HERE</a>`,
          'LINK_MYACCOUNT_SEMINAR_TC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/tc/c2m-meeting/seminar?tab=upcoming>此處</a>`,
          'LINK_MYACCOUNT_SEMINAR_SC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/sc/c2m-meeting/seminar?tab=upcoming>此处</a>`
        }
    }
  }
  
  public async prepareDynamicContentForBmList(userData: Record<string, any>, userDetailData: Record<string, any>, templateId: number, fairCode: string, fairData: Record<string, any>): Promise<any> {
    switch(templateId) {
      case NotificationTemplatesId.NEW_BM_LIST:
        return {
          'BUYER_NAME':`${userDetailData?.firstName} ${userDetailData?.lastName}`,
          'BUYER_COMPANY_NAME': userDetailData?.companyName,
          'LINK_RECOMMENED_TDC_EN': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/en/c2m-meeting/recommendation?tab=byTDC>HERE</a>`,
          'LINK_RECOMMENED_TDC_TC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/tc/c2m-meeting/recommendation?tab=byTDC>此處</a>`,
          'LINK_RECOMMENED_TDC_SC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/sc/c2m-meeting/recommendation?tab=byTDC>此处</a>`,
          'FAIR_SHORT_NAME_EN': fairData?.Fair_Short_Name.en,
          'FAIR_SHORT_NAME_TC': fairData?.Fair_Short_Name.tc,
          'FAIR_SHORT_NAME_SC': fairData?.Fair_Short_Name.sc,
          'MESSAGE_BMLIST_EN': userData?.bmMessage ? `Message from HKTDC Business Matching Team: ${userData?.bmMessage}`: '&nbsp;',
          'MESSAGE_BMLIST_TC': userData?.bmMessage ? `香港貿發局配對團隊的信息:  ${userData?.bmMessage}`: '&nbsp;',
          'MESSAGE_BMLIST_SC': userData?.bmMessage ? `香港贸发局配对团队的信息: ${userData?.bmMessage}`: '&nbsp;'
        }
      case NotificationTemplatesId.UPDATED_BM_LIST:
        return {
          'BUYER_NAME':`${userDetailData?.firstName} ${userDetailData?.lastName}`,
          'BUYER_COMPANY_NAME': userDetailData?.companyName,
          'LINK_RECOMMENED_TDC_EN': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/en/c2m-meeting/recommendation?tab=byTDC>HERE</a>`,
          'LINK_RECOMMENED_TDC_TC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/tc/c2m-meeting/recommendation?tab=byTDC>此處</a>`,
          'LINK_RECOMMENED_TDC_SC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/sc/c2m-meeting/recommendation?tab=byTDC>此处</a>`,
          'FAIR_SHORT_NAME_EN': fairData?.Fair_Short_Name.en,
          'FAIR_SHORT_NAME_TC': fairData?.Fair_Short_Name.tc,
          'FAIR_SHORT_NAME_SC': fairData?.Fair_Short_Name.sc,
          'MESSAGE_BMLIST_EN': userData?.bmMessage ? `Message from HKTDC Business Matching Team: ${userData?.bmMessage}`: '&nbsp;',
          'MESSAGE_BMLIST_TC': userData?.bmMessage ? `香港貿發局配對團隊的信息:  ${userData?.bmMessage}`: '&nbsp;',
          'MESSAGE_BMLIST_SC': userData?.bmMessage ? `香港贸发局配对团队的信息: ${userData?.bmMessage}`: '&nbsp;'
        }
      case NotificationTemplatesId.NO_RESPONSE_REMINDER:
        return {
          'BUYER_NAME':`${userDetailData?.firstName} ${userDetailData?.lastName}`,
          'BUYER_COMPANY_NAME': userDetailData?.companyName,
          'LINK_RECOMMENED_TDC_EN': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/en/c2m-meeting/recommendation?tab=byTDC>HERE</a>`,
          'LINK_RECOMMENED_TDC_TC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/tc/c2m-meeting/recommendation?tab=byTDC>此處</a>`,
          'LINK_RECOMMENED_TDC_SC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/sc/c2m-meeting/recommendation?tab=byTDC>此处</a>`,
          'FAIR_SHORT_NAME_EN': fairData?.Fair_Short_Name.en,
          'FAIR_SHORT_NAME_TC': fairData?.Fair_Short_Name.tc,
          'FAIR_SHORT_NAME_SC': fairData?.Fair_Short_Name.sc,
          'MESSAGE_BMLIST_EN': userData?.bmMessage ? `Message from HKTDC Business Matching Team: ${userData?.bmMessage}`: '&nbsp;',
          'MESSAGE_BMLIST_TC': userData?.bmMessage ? `香港貿發局配對團隊的信息:  ${userData?.bmMessage}`: '&nbsp;',
          'MESSAGE_BMLIST_SC': userData?.bmMessage ? `香港贸发局配对团队的信息: ${userData?.bmMessage}`: '&nbsp;'
        }
      case NotificationTemplatesId.NOT_ENOUGH_INTEREST_REMINDER:
        return {
          'BUYER_NAME':`${userDetailData?.firstName} ${userDetailData?.lastName}`,
          'BUYER_COMPANY_NAME': userDetailData?.companyName,
          'LINK_RECOMMENED_TDC_EN': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/en/c2m-meeting/recommendation?tab=byTDC>HERE</a>`,
          'LINK_RECOMMENED_TDC_TC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/tc/c2m-meeting/recommendation?tab=byTDC>此處</a>`,
          'LINK_RECOMMENED_TDC_SC': `<a href=${this.configService.get<string>('vepSite.domain')}event/${fairCode}/sc/c2m-meeting/recommendation?tab=byTDC>此处</a>`
        }

      default:
        return {};
    }
  }

  public async checkNotiSentPerUsers(templateId: NotificationTemplatesId, channelType: ChannelType,refUserId: string, refFairCode: string, refFiscalYear: string): Promise<NotificationEntity[]> {
    return this.notificationEntity.find({ templateId, channelType, refUserId, refFairCode, refFiscalYear });
  }

  public resetPendingMeetingNotificationStatus(oldUserId: string, newUserId: string) {

    const query = `
      UPDATE vepC2MNotification 
      LEFT JOIN vepC2MMeeting ON vepC2MNotification.meetingId = vepC2MMeeting.meetingId
      SET vepC2MNotification.notificationContent = NULL,
        vepC2MNotification.sqsResponse = NULL,
        vepC2MNotification.status = 0,
        vepC2MNotification.retryCount = 0 
      WHERE
        vepC2MNotification.notificationType = 'CREATE_MEETING' AND 
        vepC2MMeeting.status = 1 AND 
        ( vepC2MMeeting.requesterSsoUid in ('${oldUserId}','${newUserId}') OR vepC2MMeeting.responderSsoUid in ('${oldUserId}','${newUserId}') );
    `

    return getConnection().query(query)
    .then(result => {
      return {
        [constant.API_RESPONSE_FIELDS.STATUS]: constant.COMMON_CONSTANT.SUCCESS,
        affected: result.affected
      }
    })
    .catch(error => {
      return {
        [constant.API_RESPONSE_FIELDS.STATUS]: constant.GENERAL_STATUS.FAIL,
        [constant.API_RESPONSE_FIELDS.MESSAGE]: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }
    })

  }

  public filterSentNotification(
    record: any,
    id: any,
    ssoUids: string,
    fairCodes: string,
    fiscalYear: string,
    channelType: string,
    creationTimeYear: any,
    creationTimeMonth: any,
    creationTimeDay: any,
    creationTimeHour: any,
    creationTimeMinute: any,
    creationTimeSecond: any
  ): Promise<any> {
    let query = `
      SELECT 
        * 
      FROM 
        vep_c2m_service_db.vepC2MNotification 
      WHERE 
        refUserId = '${ssoUids}' 
        AND refFairCode = '${fairCodes}' 
        AND refFiscalYear = '${fiscalYear}' 
        AND templateId = 30 
        AND status = 1 
        AND channelType = '${channelType}' 
        AND YEAR(creationTime) = '${creationTimeYear}' 
        AND MONTH(creationTime) = '${creationTimeMonth}' 
        AND DAY(creationTime) = '${creationTimeDay}'
        AND HOUR(creationTime) = '${creationTimeHour}'
        AND MINUTE(creationTime) = '${creationTimeMinute}'
        AND SECOND(creationTime) = '${creationTimeSecond}'
      ORDER BY ID DESC
    `;
    // LIMIT ${this.scheduleJobLimitRetrySendingSeminarNoti}
    console.log(query);

    const connection = getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');

    return connection.query(query, undefined, slaveRunner)
    .then(async (filteredNotifications: any) => {
      if (filteredNotifications.length === 0) {
        this.logger.log(JSON.stringify({ section: 'filteredNotifications length is 0', action: 'filterSentNotification', step: '1', detail: { filteredNotifications } }));
        return {
          status: constant.GENERAL_STATUS.SUCCESS,
          filter: false,
          result: record,
        };
      } else {
        const status = EmailStatus.NO_NEED_TO_SEND;
        let lastUpdatedAt = new Date();

        this.logger.log(JSON.stringify({ section: 'filteredNotifications length is not 0', action: 'filterSentNotification', step: '1', detail: { filteredNotifications } }));
        await this.notificationEntity.save({id, status: status, lastUpdatedAt: lastUpdatedAt})
        return {
          status: constant.GENERAL_STATUS.SUCCESS,
          filter: true,
          result: null,
        };
      }
    })
    .catch((error) => {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        filter: false,
        result: `error`,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      };
    })
    .finally(() => {
      slaveRunner.release();
    })
  }

  public createNotificationRecordInC2mDb({ meetingId, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent, status }: Record<string, any>) {
    return this.notificationEntity.save({
      meetingId,
      refUserId,
      refFairCode,
      refFiscalYear,
      templateId,
      channelType,
      notificationType,
      receiverRole,
      notificationContent: JSON.stringify(notificationContent),
      status,
      retryCount: 0,
      creationTime: new Date(), 
      lastUpdatedAt: new Date(),
    })
    .then((result :any) => {
      console.log(result);
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        id: result.id,
        refId: meetingId,
        channelType,
      }
    })
    .catch((error) => {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }
    });
  }

  public createNotificationRecordInExhibitorDb({ meetingId, refUserId, refEoaFairId, templateId, channelType, notificationType, receiverRole, notificationContent, status }: Record<string, any>) {
    return this.exhibitorNotificationEntity.save({
      meetingId,
      refUserId,
      refEoaFairId,
      templateId,
      channelType,
      notificationType,
      receiverRole,
      notificationContent: JSON.stringify(notificationContent),
      status,
      retryCount: 0,
      creationTime: new Date(),
      lastUpdatedAt: new Date(),
    })
    .then((result :any) => {
      console.log(result);
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        id: result.id,
        refId: meetingId,
        channelType,
      }
    })
    .catch((error) => {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }
    });
  }

  public createNotificationRecordInFairDb({ meetingId, refUserId, refFairCode, refFiscalYear, templateId, channelType, notificationType, receiverRole, notificationContent, status }: Record<string, any>) {
    return this.buyerNotificationEntity.save({
      meetingId,
      refUserId,
      refFairCode,
      refFiscalYear,
      templateId,
      channelType,
      notificationType,
      receiverRole,
      notificationContent: JSON.stringify(notificationContent),
      status,
      retryCount: 0,
      creationTime: new Date(), 
      lastUpdatedAt: new Date(),
    })
    .then((result :any) => {
      console.log(result);
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        id: result.id,
        refId: meetingId,
        channelType,
      }
    })
    .catch((error) => {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }
    });
  }

  public createNotificationRecordCenter({ refUserId, refFairCode, refFiscalYear, refEoaFairId, templateId, notificationType, receiverRole, content, userDetailData, userData }: Record<string, any>) {
    const createdRecords: Promise<any>[] = [];

    if (templateId === NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER) {
      if (content.channels.includes('EMAIL')) {
        userDetailData.forEach((seminarData: any) => {
          createdRecords.push(
            this.createNotificationRecordInFairDb({ 
              meetingId: seminarData.seminarId,
              refUserId,
              refFairCode,
              refFiscalYear,
              templateId,
              channelType: ChannelType.EMAIL,
              notificationType,
              receiverRole,
              notificationContent: JSON.stringify(content),
              status: EmailStatus.PENDING,
            }))
        });
      }

      if (content.channels.includes('WEB')) {
        userDetailData.forEach((seminarData: any) => {
          createdRecords.push(
            this.createNotificationRecordInFairDb({ 
              meetingId: seminarData.seminarId,
              refUserId,
              refFairCode,
              refFiscalYear,
              templateId,
              channelType: ChannelType.WEB_NOTIFICATION,
              notificationType,
              receiverRole,
              notificationContent: JSON.stringify(content),
              status: EmailStatus.PENDING,
            }))
        });
      }

      if (content.channels.includes('PUSH')) {
        userDetailData.forEach((seminarData: any) => {
          createdRecords.push(
            this.createNotificationRecordInFairDb({ 
              meetingId: seminarData.seminarId,
              refUserId,
              refFairCode,
              refFiscalYear,
              templateId,
              channelType: ChannelType.PUSH,
              notificationType,
              receiverRole,
              notificationContent: JSON.stringify(content),
              status: EmailStatus.PENDING,
            }))
        });
      }
    } else if (templateId === NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS) {
      if (content.channels.includes('EMAIL')) {
        userDetailData.forEach((seminarData: any) => {
          createdRecords.push(
            this.createNotificationRecordInC2mDb({ 
              meetingId: seminarData.id,
              refUserId,
              refFairCode,
              refFiscalYear,
              templateId,
              channelType: ChannelType.EMAIL,
              notificationType,
              receiverRole,
              notificationContent: JSON.stringify(content),
              status: EmailStatus.PENDING,
            }))
        });
      }

      if (content.channels.includes('WEB')) {
        userDetailData.forEach((seminarData: any) => {
          createdRecords.push(
            this.createNotificationRecordInC2mDb({ 
              meetingId: seminarData.id,
              refUserId,
              refFairCode,
              refFiscalYear,
              templateId,
              channelType: ChannelType.WEB_NOTIFICATION,
              notificationType,
              receiverRole,
              notificationContent: JSON.stringify(content),
              status: EmailStatus.PENDING,
            }))
        });
      }

      if (content.channels.includes('PUSH')) {
        userDetailData.forEach((seminarData: any) => {
          createdRecords.push(
            this.createNotificationRecordInC2mDb({ 
              meetingId: seminarData.id,
              refUserId,
              refFairCode,
              refFiscalYear,
              templateId,
              channelType: ChannelType.PUSH,
              notificationType,
              receiverRole,
              notificationContent: JSON.stringify(content),
              status: EmailStatus.PENDING,
            }))
        });
      }
    } else if (templateId === NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER || templateId === NotificationTemplatesId.C2M_KICK_OFF_BUYER) {
      if (content.channels.includes('EMAIL')) {
        createdRecords.push(
          this.createNotificationRecordInFairDb({ 
            meetingId: 0,
            refUserId,
            refFairCode,
            refFiscalYear,
            templateId,
            channelType: ChannelType.EMAIL,
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (content.channels.includes('WEB')) {
        createdRecords.push(
          this.createNotificationRecordInFairDb({ 
            meetingId: 0,
            refUserId,
            refFairCode,
            refFiscalYear,
            templateId,
            channelType: ChannelType.WEB_NOTIFICATION, 
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (content.channels.includes('PUSH')) {
        createdRecords.push(
          this.createNotificationRecordInFairDb({ 
            meetingId: 0,
            refUserId,
            refFairCode,
            refFiscalYear,
            templateId,
            channelType: ChannelType.PUSH, 
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }
    } else if (templateId === NotificationTemplatesId.C2M_KICK_OFF_EXHIBITOR) {
      if (content.channels.includes('EMAIL')) {
        createdRecords.push(
          this.createNotificationRecordInExhibitorDb({ 
            meetingId: 0,
            refUserId,
            refEoaFairId,
            templateId,
            channelType: ChannelType.EMAIL,
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (content.channels.includes('WEB')) {
        createdRecords.push(
          this.createNotificationRecordInExhibitorDb({ 
            meetingId: 0,
            refUserId,
            refEoaFairId,
            templateId,
            channelType: ChannelType.WEB_NOTIFICATION, 
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (content.channels.includes('PUSH')) {
        createdRecords.push(
          this.createNotificationRecordInExhibitorDb({ 
            meetingId: 0,
            refUserId,
            refEoaFairId,
            templateId,
            channelType: ChannelType.PUSH, 
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }
    } else if (templateId === NotificationTemplatesId.DAILY_MEETING_SUMMARY || templateId === NotificationTemplatesId.C2M_START_REMINDER) {
      if (content.channels.includes('EMAIL')) {
        createdRecords.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: 0,
            refUserId,
            refFairCode,
            refFiscalYear,
            templateId,
            channelType: ChannelType.EMAIL,
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (content.channels.includes('WEB')) {
        createdRecords.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: 0,
            refUserId,
            refFairCode,
            refFiscalYear,
            templateId,
            channelType: ChannelType.WEB_NOTIFICATION, 
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (content.channels.includes('PUSH')) {
        createdRecords.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: 0,
            refUserId,
            refFairCode,
            refFiscalYear,
            templateId,
            channelType: ChannelType.PUSH, 
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }
    } else if (templateId === NotificationTemplatesId.NEW_BM_LIST || templateId === NotificationTemplatesId.UPDATED_BM_LIST || templateId === NotificationTemplatesId.NO_RESPONSE_REMINDER || templateId === NotificationTemplatesId.NOT_ENOUGH_INTEREST_REMINDER) {
      if (content.channels.includes('EMAIL')) {
        createdRecords.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: userData.id,
            refUserId,
            refFairCode,
            refFiscalYear,
            templateId,
            channelType: ChannelType.EMAIL,
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (content.channels.includes('WEB')) {
        createdRecords.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: userData.id,
            refUserId,
            refFairCode,
            refFiscalYear,
            templateId,
            channelType: ChannelType.WEB_NOTIFICATION, 
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (content.channels.includes('PUSH')) {
        createdRecords.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: userData.id,
            refUserId,
            refFairCode,
            refFiscalYear,
            templateId,
            channelType: ChannelType.PUSH, 
            notificationType,
            receiverRole,
            notificationContent: JSON.stringify(content),
            status: EmailStatus.PENDING,
          })
        )
      }
    }

    return createdRecords;
  }

  public createNotificationErrorRecordCenter({ refUserId, refFairCode, refFiscalYear, refEoaFairId, templateId, notificationType, error, messageBodyTemplate, userDetailData, userData }: Record<string, any>) {
    const promiseArray: Promise<any>[] = [];
    if (templateId === NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER) {
      if (messageBodyTemplate.channels.includes('EMAIL')) {
        userDetailData.forEach((seminarData: any) => {
          promiseArray.push(
            this.createNotificationRecordInFairDb({ 
              meetingId: templateId === NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS ? seminarData.id : seminarData.seminarId,
              refUserId, 
              refFairCode, 
              refFiscalYear,
              templateId,
              channelType: ChannelType.EMAIL,
              notificationType,
              receiverRole: 'ERROR',
              notificationContent: JSON.stringify(error),
              status: EmailStatus.PENDING,
            }))
        });
      }

      if (messageBodyTemplate.channels.includes('WEB')) {
        userDetailData.forEach((seminarData: any) => {
          promiseArray.push(
            this.createNotificationRecordInFairDb({ 
              meetingId: templateId === NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS ? seminarData.id : seminarData.seminarId,
              refUserId, 
              refFairCode, 
              refFiscalYear,
              templateId,
              channelType: ChannelType.WEB_NOTIFICATION,
              notificationType,
              receiverRole: 'ERROR',
              notificationContent: JSON.stringify(error),
              status: EmailStatus.PENDING,
            }))
        });
      }

      if (messageBodyTemplate.channels.includes('PUSH')) {
        userDetailData.forEach((seminarData: any) => {
          promiseArray.push(
            this.createNotificationRecordInFairDb({ 
              meetingId: templateId === NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS ? seminarData.id : seminarData.seminarId,
              refUserId, 
              refFairCode, 
              refFiscalYear,
              templateId,
              channelType: ChannelType.PUSH,
              notificationType,
              receiverRole: 'ERROR',
              notificationContent: JSON.stringify(error),
              status: EmailStatus.PENDING,
            }))
        });
      }
    } else if (templateId === NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS) {
      if (messageBodyTemplate.channels.includes('EMAIL')) {
        userDetailData ? 
        userDetailData.forEach((seminarData: any) => {
          promiseArray.push(
            this.createNotificationRecordInC2mDb({ 
              meetingId: seminarData?.id,
              refUserId,
              refFairCode,
              refFiscalYear,
              templateId,
              channelType: ChannelType.EMAIL,
              notificationType,
              receiverRole: 'ERROR',
              notificationContent: error ?? JSON.stringify(error),
              status: EmailStatus.PENDING,
            })
          )
        }) : 
        promiseArray.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: 0,
            refUserId,
            refFairCode,
            refFiscalYear,
            templateId,
            channelType: ChannelType.EMAIL,
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: error ?? JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        );
      }

      if (messageBodyTemplate.channels.includes('WEB')) {
        userDetailData ? 
        userDetailData.forEach((seminarData: any) => {
          promiseArray.push(
            this.createNotificationRecordInC2mDb({ 
              meetingId: seminarData?.id,
              refUserId, 
              refFairCode, 
              refFiscalYear,
              templateId,
              channelType: ChannelType.WEB_NOTIFICATION,
              notificationType,
              receiverRole: 'ERROR',
              notificationContent: error ?? JSON.stringify(error),
              status: EmailStatus.PENDING,
            })
          )
        }) : 
        promiseArray.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: 0,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.WEB_NOTIFICATION,
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: error ?? JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (messageBodyTemplate.channels.includes('PUSH')) {
        userDetailData ? 
        userDetailData.forEach((seminarData: any) => {
          promiseArray.push(
            this.createNotificationRecordInC2mDb({
              meetingId: seminarData?.id,
              refUserId, 
              refFairCode, 
              refFiscalYear,
              templateId,
              channelType: ChannelType.PUSH,
              notificationType,
              receiverRole: 'ERROR',
              notificationContent: error ?? JSON.stringify(error),
              status: EmailStatus.PENDING,
            })
          )
        }) :
        promiseArray.push(
          this.createNotificationRecordInC2mDb({
            meetingId: 0,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.PUSH,
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: error ?? JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }
    } else if (templateId === NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER || templateId === NotificationTemplatesId.C2M_KICK_OFF_BUYER) {
      if (messageBodyTemplate.channels.includes('EMAIL')) {
        promiseArray.push(
          this.createNotificationRecordInFairDb({ 
            meetingId: 0,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.EMAIL,
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (messageBodyTemplate.channels.includes('WEB')) {
        promiseArray.push(
          this.createNotificationRecordInFairDb({ 
            meetingId: 0,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.WEB_NOTIFICATION, 
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (messageBodyTemplate.channels.includes('PUSH')) {
        promiseArray.push(
          this.createNotificationRecordInFairDb({ 
            meetingId: 0,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.PUSH, 
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }
    } else if (templateId === NotificationTemplatesId.C2M_KICK_OFF_EXHIBITOR) {
      if (messageBodyTemplate.channels.includes('EMAIL')) {
        promiseArray.push(
          this.createNotificationRecordInExhibitorDb({ 
            meetingId: 0,
            refUserId, 
            refEoaFairId,
            templateId,
            channelType: ChannelType.EMAIL,
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (messageBodyTemplate.channels.includes('WEB')) {
        promiseArray.push(
          this.createNotificationRecordInExhibitorDb({ 
            meetingId: 0,
            refUserId, 
            refEoaFairId,
            templateId,
            channelType: ChannelType.WEB_NOTIFICATION, 
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (messageBodyTemplate.channels.includes('PUSH')) {
        promiseArray.push(
          this.createNotificationRecordInExhibitorDb({ 
            meetingId: 0,
            refUserId, 
            refEoaFairId,
            templateId,
            channelType: ChannelType.PUSH, 
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }
    } else if (templateId === NotificationTemplatesId.DAILY_MEETING_SUMMARY || templateId === NotificationTemplatesId.C2M_START_REMINDER) {
      if (messageBodyTemplate.channels.includes('EMAIL')) {
        promiseArray.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: 0,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.EMAIL,
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (messageBodyTemplate.channels.includes('WEB')) {
        promiseArray.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: 0,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.WEB_NOTIFICATION, 
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (messageBodyTemplate.channels.includes('PUSH')) {
        promiseArray.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: 0,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.PUSH, 
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }
    } else if (templateId === NotificationTemplatesId.NEW_BM_LIST || templateId === NotificationTemplatesId.UPDATED_BM_LIST || templateId === NotificationTemplatesId.NO_RESPONSE_REMINDER || templateId === NotificationTemplatesId.UPDATED_BM_LIST) {
      if (messageBodyTemplate.channels.includes('EMAIL')) {
        promiseArray.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: userData?.id,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.EMAIL,
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (messageBodyTemplate.channels.includes('WEB')) {
        promiseArray.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: userData?.id,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.WEB_NOTIFICATION, 
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }

      if (messageBodyTemplate.channels.includes('PUSH')) {
        promiseArray.push(
          this.createNotificationRecordInC2mDb({ 
            meetingId: userData?.id,
            refUserId, 
            refFairCode, 
            refFiscalYear,
            templateId,
            channelType: ChannelType.PUSH, 
            notificationType,
            receiverRole: 'ERROR',
            notificationContent: JSON.stringify(error),
            status: EmailStatus.PENDING,
          })
        )
      }
    }

    return promiseArray;
  }

  public async updateNotificationRecordCenter({ templateId, recordId, channelType, snsResponse }: Record<string, any>) {
    if (templateId === NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER || templateId === NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER || templateId === NotificationTemplatesId.C2M_KICK_OFF_BUYER) {
      return this.buyerNotificationEntity.save({ id: recordId, channelType: channelType, status: EmailStatus.SENT, sqsResponse: JSON.stringify(snsResponse), lastUpdatedAt: new Date() })
    } else if (templateId === NotificationTemplatesId.C2M_KICK_OFF_EXHIBITOR) {
      return this.exhibitorNotificationEntity.save({ id: recordId, channelType: channelType, status: EmailStatus.SENT, sqsResponse: JSON.stringify(snsResponse), lastUpdatedAt: new Date() })
    } else {
      return this.notificationEntity.save({ id: recordId, channelType: channelType, status: EmailStatus.SENT, sqsResponse: JSON.stringify(snsResponse), lastUpdatedAt: new Date() })
    }
  }

  public async sendMessageToSns(messageBody: NotiSqsMessageBodyDto): Promise<any> {
    try {
      let msgBody = messageBody; // handling metadata and placeholder
      this.logger.log(JSON.stringify({ section: 'sendMessageToSns', action: `messageBody: ${messageBody ?? JSON.stringify(messageBody)}, msgBody.channels: ${msgBody.channels}, msgBody.queueType: ${msgBody.queueType}`, step: '1' }));
      let result = await this.snsService.sendNotificationBySns(msgBody, msgBody.channels, msgBody.queueType);
      this.logger.log("sns result");
      this.logger.log(result);
      this.logger.log(JSON.stringify(result));
      return result;
    } catch (e) {
      this.logger.log(JSON.stringify({ section: 'sendMessageToSns', action: `error message: ${JSON.stringify(e)}`, step: 'catch error' }));
      console.error(e);
      return {
        error: JSON.stringify(e),
        data: ""
      };
    }
  }

  public async sendSnsNotificationCenter({ userDetailData, userId, fairCode, fiscalYear, refEoaFairId, templateId, notificationType, receiverRole, content }: Record<string, any>) {
    const createdRecords = this.createNotificationRecordCenter({
      refUserId: userId,
      refFairCode: fairCode,
      refFiscalYear: fiscalYear,
      refEoaFairId,
      templateId,
      notificationType,
      receiverRole,
      content,
      userDetailData,
    })

    this.logger.log(JSON.stringify({ section: 'sendSnsNotificationCenter', action: `content sent to SNS: ${JSON.stringify(content)}`, step: 'before sending to sns' }));
    const snsResult = this.sendMessageToSns(<NotiSqsMessageBodyDto>content)

    // use return Promise.all() instead of return Promise.allSettled() -> all the seminar records of the user should be created successfully, then send noti
    return Promise.all([Promise.all(createdRecords), snsResult])
    .then(([createdRecords, snsResult]): any => {
      if (!snsResult || snsResult.error) {
        this.logger.log(JSON.stringify({ section: 'sendSnsNotificationCenter', action: `No SNS result: ${JSON.stringify(content)}`, step: 'error' }));
        return Promise.reject({
          message: 'No SNS result'
        });
      }

      this.logger.log(JSON.stringify({ section: 'sendSnsNotificationCenter', action: `content sent to SNS: ${JSON.stringify(content)}`, step: 'after sending to sns' }));

      const failIds: any[] = [];
      createdRecords.forEach((record: any) => {
        if (record.status === constant.GENERAL_STATUS.FAIL) {
          failIds.push(record);
        }
      });

      // if there are any records created fail, don't send to SQS
      if (failIds.length > 0) {
        return Promise.reject(`There are at least one seminarId cannot be created the record in vepC2MNotification table. Details: ${JSON.stringify(failIds)}`);
      }

      return Promise.all([createdRecords, snsResult]);
    })
    .then(([createdRecords, snsResult]): any => {
      let resultArray: Promise<any>[] = [];
      createdRecords.forEach((record: any) => {
        resultArray.push(this.updateNotificationRecordCenter({ templateId, recordId: record.id, channelType: record.channelType, snsResponse: snsResult }))
      });
      return Promise.all([createdRecords, resultArray])
    })
    .then(async ([createdRecords, result]) => {
      if (templateId === NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS) {
        const tableIdArray: any[] = [];
        const channelTypeArray: any[] = [];
        createdRecords.forEach((notiRecord: any) => {
          tableIdArray.push(notiRecord.refId);
          channelTypeArray.push(notiRecord.channelType);
        });
        // console.log(tableIdArray);
  
        return {
          status: 200,
          sqsData: result?.data ?? result,
          channelType: channelTypeArray,
          tableId: tableIdArray
        };
      }

      return Promise.all(result)
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'sendSnsNotificationCenter', action: `sendSnsMessage result error - email, Message: ${JSON.stringify(RejectedData)}`, step: 'error' }));
      return {
        status: 400,
        message: `sendSnsMessage result error - email, Message: ${JSON.stringify(RejectedData)}`,
      };
    });
  }

  public async sendSnsNotificationBmList({ userDetailData, userId, fairCode, fiscalYear, refEoaFairId, templateId, notificationType, receiverRole, content, userData }: Record<string, any>) {
    const createdRecords = this.createNotificationRecordCenter({
      refUserId: userId,
      refFairCode: fairCode,
      refFiscalYear: fiscalYear,
      refEoaFairId,
      templateId,
      notificationType,
      receiverRole,
      content,
      userDetailData,
      userData,
    })

    return Promise.all(createdRecords)
    .then((createdRecords): any => {
      const failIds: any[] = [];
      createdRecords.forEach((record: any) => {
        if (record.status === constant.GENERAL_STATUS.FAIL) {
          failIds.push(record);
        }
      });

      // if there are any records created fail, don't send to SNS
      if (failIds.length > 0) {
        return Promise.reject(`There are at least one seminarId cannot be created the record in vepC2MNotification table. Details: ${JSON.stringify(failIds)}`);
      }

      return Promise.all([createdRecords, this.sendMessageToSns(<NotiSqsMessageBodyDto>content)]);
    })
    .then(([createdRecords, snsResult]): any => {
      if (!snsResult || snsResult.error) {
        return Promise.reject({
          message: 'No SNS result'
        });
      }

      let resultArray: Promise<any>[] = [];
      createdRecords.forEach((record: any) => {
        resultArray.push(this.updateNotificationRecordCenter({ templateId, recordId: record.id, channelType: record.channelType, snsResponse: snsResult }))
      });
      return Promise.all([createdRecords, resultArray])
    })
    .then(async ([createdRecords, result]) => {
      let updatedPromiseArray: Promise<any>[] = [];
      if (templateId === NotificationTemplatesId.NEW_BM_LIST || templateId === NotificationTemplatesId.UPDATED_BM_LIST) {
        createdRecords.forEach((record: any) => {
          if (record.channelType === ChannelType.EMAIL) {
            updatedPromiseArray.push(this.recommendationRepository.update(
              {
                id: userData.id
              },
              {
                emailStatus: 1,
                lastUpdatedAt: new Date()
              }
            ))
          } else if (record.channelType === ChannelType.WEB_NOTIFICATION) {
            updatedPromiseArray.push(this.recommendationRepository.update(
              {
                id: userData.id
              },
              {
                notificationStatus: 1,
                lastUpdatedAt: new Date()
              }
            ))
          }
        })
      }

      const updatedArray = await Promise.all(updatedPromiseArray);

      return {
        status: 200,
        content,
        data: {
          data: result?.data ?? result,
          updatedArray: updatedArray,
        }
      };
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email - Seminar', action: `sendSnsMessage result error - email, Message: ${JSON.stringify(RejectedData)}`, step: 'error' }));
      return {
        status: 400,
        message: `sendSnsMessage result error - email, Message: ${JSON.stringify(RejectedData)}`,
      };
    });
  }  

  public getSQSQueryR3 = (meetingStartTime: Date) => {
    const today = moment().format('DD-MM-YYYY');

    if (today === moment(meetingStartTime).format('DD-MM-YYYY')) {
      return 'FAST';
    }
    return 'STANDARD';
  }

  public updateNotificationSqsSatuts({meetingId, notificationId, status, retryCount, sqsResponse}: Record<string, any>) {
    return this.notificationEntity.update(
      {
        meetingId,
        id: notificationId
      },
      {
        status,
        retryCount,
        sqsResponse,
        lastUpdatedAt: new Date()
      }
    )
    .then((result :any) => {
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        message: 'update notification sqs status succee',
        data: {
          result,
        }
      }
    })
    .catch((error) => {
      this.logger.log(JSON.stringify({ section: 'Email', action: 'updateNotificationSqsSatuts', detail: error ?? JSON.stringify(error), step: 'catch error' }));
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: error ?? JSON.stringify(error)
      }
    });
  }

  public sendSnsNotificationMeeting({ meetingData, recordCreation, notificationType, receiverRole, content, retryCount }: Record<string, any>) {
    const recordCreationResult: Promise<any>[] = [];
    recordCreation.forEach((record: any) => {
      recordCreationResult.push(this.updateNotificationRecord({ meetingId: meetingData.id, notificationId: record.id, notificationType, receiverRole, notificationContent: content }))
    })

    return Promise.all(recordCreationResult)
    .then((recordCreationResult) => {
      return Promise.all([
        this.sendMessageToSns(<NotiSqsMessageBodyDto>content),
        Promise.resolve(recordCreationResult)
      ]);
    })
    .then(([snsResult, notificationResult]): any => {
      if (!snsResult || snsResult.error) {
        return Promise.reject({
          message: 'No SNS result'
        });
      }

      if (!notificationResult) {
        return Promise.reject({
          notificationResult: null,
          message: 'Cant update notification record'
        });
      }

      const recordUpdateResult: Promise<any>[] = [];
      recordCreation.forEach((record: any) => {
        recordUpdateResult.push(this.updateNotificationSqsSatuts({ meetingId: meetingData.id, notificationId: record.id, status: EmailStatus.SENT, retryCount, sqsResponse: JSON.stringify(snsResult) }))
      })

      return Promise.all(recordUpdateResult)
      // return this.updateNotificationStatus({ meetingId: meetingData.id, notificationId: notificationRecord.id, status: EmailStatus.SENT, retryCount });
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email', action: 'sendSqsMessage result error - email', detail: RejectedData, step: '3' }));

      recordCreation.forEach(async (record: any) => {
        await this.notificationEntity.save({id: record.id, status: EmailStatus.SEND_TO_SNS_ERROR, retryCount, notificationContent: JSON.stringify(content), sqsResponse: JSON.stringify(RejectedData), lastUpdatedAt: new Date() })
      })
      // return this.updateNotificationStatus({ meetingId: meetingData.id, notificationId: notificationRecord.id, status: EmailStatus.SEND_TO_SNS_ERROR, retryCount });
    });
  }


  public sendSnsNotificationForSeminarRetry({
    userDetailData, 
    userId,
    fairCode,
    fiscalYear,
    refEoaFairId,
    templateId, 
    notificationType,  
    receiverRole, 
    content,
    notiTableId,
    seminarTableId,
    retryCount,
    channelType,
  }: Record<string, any>) {
    // update the retryCount by noti tabel ID
    let tableId = 0;
    const updatedRecords: Promise<any>[] = [];
    const updatedSNSRecords: Promise<any>[] = [];
    notiTableId.forEach((notiId: any) => {
      updatedRecords.push(this.notificationEntity.save({ id: notiId, notificationContent: JSON.stringify(content), retryCount, lastUpdatedAt: new Date() }))
    });
    return Promise.all(updatedRecords)
    .then(result => {
      return Promise.all([result, this.sendMessageToSns(<NotiSqsMessageBodyDto>content)]);
    })
    .then(([result, snsResult]: any )=> {
      // if (!snsResult || snsResult.error) {
      //   return Promise.reject({
      //     message: 'No SNS result'
      //   });
      // }

      result.forEach((record: any) => {
        updatedSNSRecords.push(this.notificationEntity.save({ id: record.id, status: EmailStatus.SENT, sqsResponse: JSON.stringify(snsResult), lastUpdatedAt: new Date() }))
      });
      return Promise.all(updatedSNSRecords)
    })
    .then(result => {
      const tableIdArray: any[] = [];
      seminarTableId.forEach((seminarId: any) => {
        tableIdArray.push(seminarId);
      });
      // console.log(tableIdArray);

      return {
        status: 200,
        sqsData: result,
        channelType,
        tableId: tableIdArray
      };
    })
    .catch((RejectedData: any): any => {
      this.logger.log(JSON.stringify({ section: 'Email - Seminar', action: `sendSqsMessage result error - email, Message: ${RejectedData}`, step: '2' }));
      return {
        status: 400,
        message: `sendSqsMessage result error - email, Message: ${RejectedData}`,
        tableId
      };
    });
  }
}

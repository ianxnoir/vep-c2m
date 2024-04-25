/* eslint-disable arrow-parens */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import moment from 'moment-timezone';
import { getConnection, Repository } from 'typeorm';
import { constant } from '../../config/constant';
import { Logger } from '../../core/utils';
import { C2mConfigEntity } from '../../entities/c2mConfig.entity';
import { Meeting } from '../../entities/meeting.entity';
import { MeetingConfig } from '../../entities/meetingConfig.entity';
import { NotificationEntity } from '../../entities/notification.entity';
import { UserMeta } from '../../entities/userMeta';
import { BuyerService } from '../api/buyer/buyer.service';
import { ApiExhibitorService } from '../api/exhibitor/exhibitor.service';
import { ApiFairService } from '../api/fair/fair.service';
import { NotificationAPIService } from '../api/notificationAPI/notificationAPI.service';
import { MeetingRole, MeetingStatus, ResponseStatus } from './meeting/meeting.type';
import { NotificationService } from './notification/notification.service';
import { ChannelType, EmailStatus, notificationGroup, NotificationTemplatesId, NotificationType, ReceiverRole, templateSource } from './notification/notification.type';
import { UserMetaKey } from './unavailableTimeslot/unavailableTimeslot.type';
import { remapCounterUserProfile, remapUserProfile } from './utils';

interface handleNotification {
  templateId: number;
  notificationType: string;
  meetingData: Meeting;
  fairCode: string;
  isRequester: boolean;
  skipWebNotifiction?: boolean;
}
interface handleNotificationForRetry {
  templateId: number;
  notificationType: string;
  meetingData: Meeting;
  fairCode: string;
  isRequester: boolean;
  channelType: ChannelType;
  notificationRecord: NotificationEntity;
  retryCount: number;
}

interface handleNotificationSummary {
  userData: any,
  currFair: Record<string, any>,
  summaryDate: any,
  messageBodyTemplate: any,
}

interface handleNotificationKickOff {
  templateId: number;
  notificationType: string;
  receiverRole: string;
  userData: any;
  currFair: any;
  messageBodyTemplate: any;
  recommendExhibitors?: any[];
  registrationNo?: string | string[];
}

interface handleNotificationForSeminar {
  templateId: number;
  notificationType: string;
  userData: any;
  userWithSeminarData: any;
  messageBodyTemplate: any;
}

interface handleNotificationForSeminarSummary {
  templateId: number;
  notificationType: string;
  userData: any;
  successSeminarsEn: any; 
  successSeminarsTc: any; 
  successSeminarsSc: any;
  whereConditionsForEvent: any;
  seminarSummaryStartRange: any;
  seminarSummaryEndRange: any;
  messageBodyTemplate: any;
}

interface handleNotificationForSeminarRetry {
  templateId: any;
  notificationType: any;
  userData: any;
  userWithSeminarData: any;
  channelType: string;
  notiTableId: any;
  seminarTableId: any;
  retryCount: number;
}

interface handleNotificationForSeminarSummaryRetry {
  templateId: number;
  notificationType: string;
  userData: any;
  userWithSeminarData: any;
  seminarSummaryStartRange: any;
  seminarSummaryEndRange: any;
  notiTableId: any;
  channelType: any;
  retryCount: any;
}
interface handleNotificationForBmList {
  templateId: number;
  notificationType: string;
  receiverRole: string;
  userData: any;
}

interface handleNotificationForBmListRetry {
  templateId: number;
  notificationType: string;
  receiverRole: string;
  userData: any;
  channelType: string;
  retryCount: number;
}

interface preparePlaceHoldersAndSendToSns {
  notificationType: string,
  userData: any,
  userDetailData: any,
  templateId: number,
  fairCode: string,
  isBuyer: boolean,
  seminarSummaryStartRange?: any,
  seminarSummaryEndRange?: any,
  firstName: any,
  lastName: any,
  currFair?:any,
  recommendExhibitors?: any,
  notificationGroup: string,
  messageBodyTemplate: any;
  emailIds: any;
  lang: any;
}



@Injectable()
export class C2MService {
  constructor(
    @InjectRepository(UserMeta)
    private userMetaRepository: Repository<UserMeta>,
    @InjectRepository(C2mConfigEntity)
    private c2mConfigEntity: Repository<C2mConfigEntity>,
    @InjectRepository(MeetingConfig)
    private meetingConfigRepository: Repository<MeetingConfig>,
    private fairService: ApiFairService,
    private notificationService: NotificationService,
    private notificationAPIService: NotificationAPIService,
    private buyerService: BuyerService,
    private apiExhibitorService: ApiExhibitorService,
    private logger: Logger,
    private configService: ConfigService
  ) {}

  public getDummyData(): Record<string, any> {
    return {
      hello: 'world'
    };
  }

  public verifyCollidedSeminar(fairCode: string, ssoUid: string, startTime: Date, endTime: Date): Record<string, any> {
    // TO-DO get reqistered seminars by ssoUid with fairCode, !! this is hardCode Fake, need to integrate with real
    const targetTime = moment().add(1, 'd').hour(8).minute(10).second(0).millisecond(0);
    const collided = moment(startTime).isSame(targetTime);

    const collidedCount = collided ? Math.floor(Math.random() * 10 + 1) : 0;
    let isCollided = collidedCount || moment(startTime).format('HH:mm') === targetTime.format('HH:mm');

    return { collidedCount, isCollided };
  }

  public async getUserConsent(ssoUid: string): Promise<boolean> {
    const data = await this.userMetaRepository.findOne({ ssoUid, key: UserMetaKey.ACCEPTED_C2M_CONSENT, value: '1' });

    return !!data;
  }

  public async createUserConsent(ssoUid: string): Promise<UserMeta> {
    const newUserMeta = this.userMetaRepository.create({
      ssoUid,
      key: UserMetaKey.ACCEPTED_C2M_CONSENT,
      value: '1',
      creationTime: new Date(),
      lastUpdatedAt: new Date()
    });

    return this.userMetaRepository.save(newUserMeta);
  }

  // ------------------------------------------------ Notification ------------------------------------------------ //

  /*
  /*  Handle below notifications:
  /*  1. CREATE_MEETING (isRequester: false -> send to responder)
  /*  2. RESCHEDULE_MEETING (isRequester: false -> send to responder)
  /*  3. ACCEPT_MEETING (isRequester: false -> send to responder, isRequester: true -> send to resquester)
  /*  4. REJECT_MEETING
  /*  5. CANCEL_MEETING
  /*  6. AUTO_CANCEL_MEETING
  /*  7. BM_CREATE_MEETING (isRequester: false -> send to responder, isRequester: true -> send to resquester)
  /*  8. BM_CREATE_MEETING_NO_PENDING_MEETING (isRequester: false -> send to responder, isRequester: true -> send to resquester)
  /*  9. BM_CREATE_MEETING_WITH_PENDING_MEETING (isRequester: false -> send to responder, isRequester: true -> send to resquester)
  /*  10. RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR (isRequester: false -> send to real responder)
  /*  11. CANCEL_BM_MEETING_BY_BUYER_OR_EXHIBITOR (isRequester: false -> send to real responder)
  /*  12. CANCEL_BM_MEETING_BY_BM (isRequester: false -> send to responder, isRequester: true -> send to resquester)
  /*  13. CANCEL_C2M_MEETING_BY_BM
  /*  14. MEETING_REMINDER
  /*  15. BM_RESCHEDULE_MEETING_NO_PENDING_MEETING
  /*  16. BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING
  */
  public async handleNotification({ templateId, notificationType, meetingData, fairCode, isRequester, skipWebNotifiction }: handleNotification) {
    return this.notificationAPIService.getMessageBodyForSns({ templateId, templateSource: templateSource.DIRECT })
    .then((messageBodyTemplate) => {
      if (messageBodyTemplate.status === 400 && !messageBodyTemplate.data) {
        this.logger.log(JSON.stringify({ action: 'handleNotification', section: `Notification - getMessageBodyForSns`, step: 'error', detail: `Request failed ${templateId} ${fairCode}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}` }));
        return Promise.reject(`Request failed ${templateId} ${fairCode}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}`);
      }

      let targetChannelType: string[] = [];
      if (messageBodyTemplate.data.channels.includes('EMAIL')) {
        targetChannelType.push(ChannelType.EMAIL) 
      }
      if (messageBodyTemplate.data.channels.includes('WEB')) {
        targetChannelType.push(ChannelType.WEB_NOTIFICATION) 
      }
      if (messageBodyTemplate.data.channels.includes('PUSH')) {
        targetChannelType.push(ChannelType.PUSH) 
      }

      if(targetChannelType.length === 0) {
        this.logger.log(JSON.stringify({ action: 'handleNotification', section: `Notification - checkChannelType`, step: 'error', detail: `targetChannelType ${targetChannelType} is empty, no need to send` }));
        return Promise.reject(`targetChannelType ${targetChannelType} is empty, no need to send`);
      }

      return Promise.all([messageBodyTemplate, targetChannelType])
    })
    .then(async ([messageBodyTemplate, targetChannelType]: any[]) => {
      const recordCreationPromise: Promise<any>[] = [];

      let receiverData = {
        receiverRole: '',
        receiverSsouid: '',
        receiverFairCode: '',
        receiverFairYear: '',
        receiverFirstName: '',
        receiverLastName: '',
      }
      if (isRequester) {
        receiverData.receiverRole = meetingData.requesterRole;
        receiverData.receiverSsouid = meetingData.requesterSsoUid;
        receiverData.receiverFairCode = meetingData.fairCode;
        receiverData.receiverFairYear = meetingData.fiscalYear;
        receiverData.receiverFirstName = meetingData.requesterFirstName;
        receiverData.receiverLastName = meetingData.requesterLastName;
      } else {
        receiverData.receiverRole = meetingData.responderRole;
        receiverData.receiverSsouid = meetingData.responderSsoUid;
        receiverData.receiverFairCode = meetingData.responderFairCode;
        receiverData.receiverFairYear = meetingData.responderFiscalYear;
        receiverData.receiverFirstName = meetingData.responderFirstName;
        receiverData.receiverLastName = meetingData.responderLastName;
      }
      
      targetChannelType.forEach((type: any) => {
        recordCreationPromise.push(
          this.notificationService
            .createNotificationRecord({
              meetingId: meetingData.id, 
              refUserId: receiverData.receiverSsouid, 
              refFairCode: receiverData.receiverFairCode, 
              refFiscalYear: receiverData.receiverFairYear, 
              templateId, 
              channelType: type, 
              notificationType, 
              receiverRole: receiverData.receiverRole, 
              notificationContent: '',
            })
        );
      });

      return Promise.all([messageBodyTemplate, receiverData, Promise.all(recordCreationPromise), this.fairService.getNamesObj(receiverData.receiverFairCode)])
    })
    .then(([messageBodyTemplate, receiverData, recordCreation, fairResult]): any => {
      if (!fairResult || fairResult.status === 400) {
        this.logger.log(JSON.stringify({ action: 'handleNotification', section: 'Notification - getNamesObj', step: 'error', detail: `get fair info fail - Input: ${meetingData.fairCode} ; API response: ${fairResult.message}` }));
        return Promise.reject({
          status: 400,
          message: `get fair info fail - Input: ${meetingData.fairCode} ; API response: ${fairResult.message}`,
        })
      }

      console.log('recordCreationPromise', recordCreation)

      return Promise.all([
        messageBodyTemplate,
        receiverData,
        recordCreation,
        fairResult,
        this.getUserInfo({ fairCode, meetingData, isRequester }),
        this.getUserInfo({ fairCode, meetingData, isRequester: !isRequester })
      ])
    })
    .then(([messageBodyTemplate, receiverData, recordCreation, fairResult, profileResult, counterProfile]) => {
      if (profileResult.status === 400 || !profileResult.userProfile) {
        // return Promise.reject('Cant get profile');
        this.logger.log(JSON.stringify({ action: 'getSelfProfile', section: 'getSelfProfile', step: 'error', detail: 'Cant get self profile' }));
      }
      if (counterProfile.status === 400) {
        // return Promise.reject('Cant get counter profile');
        this.logger.log(JSON.stringify({ action: 'getCounterProfile', section: 'getCounterProfile', step: 'error', detail: 'Cant get counter profile' }));
      }
      const userProfile = remapUserProfile(profileResult.userProfile);
      const newCounterProfile = remapCounterUserProfile(profileResult.userProfile, counterProfile.userProfile);
      const preparedContent = this.notificationService.prepareDynamicContent(
        meetingData,
        userProfile,
        templateId,
        fairResult,
        userProfile.userTimezone,
        newCounterProfile,
        receiverData.receiverFairCode,
      );

      return Promise.all([messageBodyTemplate, receiverData, recordCreation, userProfile, newCounterProfile, preparedContent]);
    })
    .then(([messageBodyTemplate, receiverData, recordCreation, userProfile, newCounterProfile, preparedContent]) => {
      const messageBodyContent = this.mapDataForSnsMessageBodyForMeeting({
        messageBodyTemplate,
        meetingData,
        emailIds: userProfile.emailId, 
        placeholders: preparedContent, 
        userId: receiverData.receiverSsouid, 
        fairCode: receiverData.receiverFairCode, 
        isBuyer: receiverData.receiverRole === 'BUYER' ? true : false, 
        lang: userProfile.preferredLanguage, 
        firstName: receiverData.receiverFirstName, 
        lastName: receiverData.receiverLastName,
        overseasBranchOffice: userProfile.overseasBranchOffice,
      })

      return Promise.all([receiverData, recordCreation, messageBodyContent]);
    })
    .then(async ([receiverData, recordCreation, messageBodyContent]) => {
      const retryCount = 0;

      const sentOutNotiResult = await this.notificationService.sendSnsNotificationMeeting({
        meetingData, 
        recordCreation,
        notificationType, 
        receiverRole: receiverData.receiverRole, 
        content: messageBodyContent, 
        retryCount
      })

      this.logger.log(JSON.stringify({ action: 'handleNotification', section: 'handleNotification', step: 'final', detail: sentOutNotiResult ?? JSON.stringify(sentOutNotiResult) }))
    })
    .catch((error) => {
      this.logger.log(JSON.stringify({ action: 'handleNotification', section: 'handleNotification', step: 'error', detail: error }));
    })
  }

  public async getUserInfo({ fairCode, meetingData, isRequester }: Record<string, any>): Promise<any> {
    const targetFieldPrefix = isRequester ? 'requester' : 'responder';
    const userId = meetingData[`${targetFieldPrefix}SsoUid`];
    const targetRoles = meetingData[`${targetFieldPrefix}Role`];

    if (targetRoles.toUpperCase() === 'EXHIBITOR') {
      return this.apiExhibitorService
        .getExhibitorProfilesByCCDID([userId])
        .then((result) => {
          console.log(result)
          const exhibitorProfile = result?.data?.[0]?.records?.[0];
          if (!exhibitorProfile) {
            return Promise.reject(`Couldnt find exhibitor profile ${userId}`);
          }
          return Promise.all([
            Promise.resolve(exhibitorProfile),
            this.apiExhibitorService.getExhibitorProfile(exhibitorProfile.contactEmail),
            this.buyerService.getTimezoneAndPreferredLang(meetingData.fairCode, userId, exhibitorProfile.contactEmail)
          ]);
        })
        .then(([exhibitorProfile, exhibitorProfileV2, exhibitorTimezoneAndPreferredLanguage]) => {
          if (!exhibitorProfileV2?.data?.data) {
            // todo
            return Promise.reject(`Couldnt find exhibitor profile v2 ${userId}`);
          }
          if (!exhibitorTimezoneAndPreferredLanguage) {
            this.logger.log(JSON.stringify({ action: 'getExhibitorPreferredLanguage', section: 'getExhibitorPreferredLanguage', step: 'error', detail: `Couldnt find exhibitor preferred language ${userId}` }));
          }
          return {
            status: 200,
            userProfile: {
              ...exhibitorProfile,
              userTimezone: this.isValidTimeZone(exhibitorProfileV2?.data?.data?.userTimezone)
                ? exhibitorProfileV2?.data?.data?.userTimezone
                : 'Asia/Hong_Kong',
              preferredLanguage: exhibitorTimezoneAndPreferredLanguage?.data?.preferredLanguage || 'en',
              preferredChannel: exhibitorTimezoneAndPreferredLanguage?.data?.preferredChannels || ['EMAIL']
            }
          };
        })
        .catch((error) => ({
          status: 400,
          message: error?.message ?? JSON.stringify(error)
        }));
    }

    if (targetRoles.toUpperCase() === 'BUYER') {
      return this.fairService
        .getFairParticipantRegistrations([userId])
        .then(async (result: any) => {
          const buyerProfile = result?.data?.[0]?.records[0];
          if (!buyerProfile) {
            // todo
            return Promise.reject(`Couldnt find buyer profile ${userId}`);
          }
          return Promise.all([Promise.resolve(result?.data?.[0]), this.buyerService.getTimezoneAndPreferredLang(meetingData.fairCode, userId, buyerProfile.emailId)]);
        })
        .then(([buyerProfile, buyerTimezoneAndPreferredLanguage]) => {
          const buyerProfileV2 = buyerTimezoneAndPreferredLanguage?.data;
          if (!buyerProfileV2) {
            // return Promise.reject(`Couldnt find buyer profile v2 ${userId}`);
            this.logger.log(JSON.stringify({ action: 'getBuyerProfileV2', section: 'getBuyerProfileV2', step: 'error', detail: `Couldnt find buyer profile v2 ${userId}` }));
          }
          let buyerProfileV1: any;
          let buyerProfileRecordsArray: any[] = buyerProfile.records;
          let targetFairCode: string;

          if (meetingData.rescheduledTime > 0 && meetingData.requesterRole === MeetingRole.EXHIBITOR && (meetingData.requesterResponseStatus === ResponseStatus.REQ_RESCHEDULE || meetingData.requesterResponseStatus === ResponseStatus.PENDING)) {
            targetFairCode = meetingData.responderFairCode;
          } else {
            targetFairCode = fairCode;
          }
          buyerProfileRecordsArray.forEach((buyerProfileRecord: any) => {
            if (targetFairCode === buyerProfileRecord.fairCode) {
              buyerProfileV1 = buyerProfileRecord;
            }
          });
          return {
            status: 200,
            userProfile: {
              ...buyerProfileV2,
              // ...buyerProfile.records?.[0],
              ...buyerProfileV1,
              userTimezone: this.isValidTimeZone(buyerProfileV2?.userTimezone) ? buyerProfileV2?.userTimezone : 'Asia/Hong_Kong',
              preferredChannel: buyerTimezoneAndPreferredLanguage?.data?.preferredChannels || ['EMAIL']
            }
          };
        })
        .catch((error) => ({
            status: 400,
            message: error?.message ?? JSON.stringify(error)
        }));
    }

    return Promise.reject({
      status: 400,
      message: 'Role is wrong'
    });
  }

  // check the timeZone format whether correct or not
  private isValidTimeZone(timeZone: string): boolean {
    if (!Intl || !Intl.DateTimeFormat().resolvedOptions().timeZone) {
      throw new Error('Time zones are not available in this environment');
    }

    try {
      Intl.DateTimeFormat(undefined, { timeZone });
      return true;
    } catch (ex) {
      return false;
    }
  }

  // ------------------------------------------------ End of Notification ------------------------------------------------ //
  // ------------------------------------------------ Center Function of R3 Notification --------------------------------- //

  public async mapDataForSnsMessageBodyForMeeting({ messageBodyTemplate, meetingData, emailIds, placeholders, userId, fairCode, isBuyer, lang, firstName, lastName, overseasBranchOffice }: any) {
    const templateData = messageBodyTemplate?.data;
    const templateId = messageBodyTemplate?.data?.templateId;

    if (templateData.emailIds.length > 0) {
      templateData.emailIds.pop();
    }
    templateData.emailIds.push(emailIds);
    templateData.placeholders = placeholders;
    templateData.queueType = this.notificationService.getSQSQueryR3(meetingData.startTime)

    let meetingStatus = '';
    if (meetingData.status === 0) {
      meetingStatus = 'PENDING';
    } else if (meetingData.status === 1) {
      meetingStatus = 'UPCOMING';
    } else if (meetingData.status === 2 || meetingData.status === 3 || meetingData.status === 4) {
      meetingStatus = 'CANCEL';
    }

    templateData.metaData.urlLink = this.notificationService.generateC2MLink(meetingStatus, fairCode, lang)
    templateData.metaData.fairCode = fairCode;
    templateData.metaData.language = lang;
    templateData.metaData.notificationType = notificationGroup.MEETINGS;
    templateData.metaData.year = new Date().getFullYear();
    templateData.metaData.firstName = firstName;
    templateData.metaData.lastName = lastName;
    templateData.metaData.from = this.configService.get<string>('notification.from');
    templateData.metaData.fromName = 'HKTDC Exhibitions';
    
    if (isBuyer) {
      templateData.metaData.toRole = 'BUYER';
      // templateData.metaData.ssoUid = userId;
    } else {
      templateData.metaData.toRole = 'EXHIBITOR';
      // templateData.metaData.companyCcdId = userId;
    }

    let officeEmail = '';
    if (
        templateId === NotificationTemplatesId.RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR ||
        templateId === NotificationTemplatesId.CANCEL_BM_MEETING_BY_BUYER_OR_EXHIBITOR ||
        templateId === NotificationTemplatesId.CANCEL_BM_MEETING_BY_BM_TO_RESPONDER ||
        templateId === NotificationTemplatesId.CANCEL_BM_MEETING_BY_BM_TO_REQUESTER ||
        templateId === NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_BUYER ||
        templateId === NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR ||
        templateId === NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_BUYER ||
        templateId === NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR
    ) {
        const query = `SELECT * FROM vep_content.vep_council_global_office where office_code = '${overseasBranchOffice}'`;

        const connection = await getConnection('contentDatabase');
        const slaveRunner = connection.createQueryRunner('slave');
        let relatedOfficeInfo: any;
        try {
          relatedOfficeInfo = await connection.query(query, undefined, slaveRunner);
        } catch (error) {
          console.log("Error in mapDataForSnsMessageBodyForMeeting api", error)
        } finally {
          slaveRunner.release();
        }
        officeEmail = relatedOfficeInfo?.[0]?.email || '';
    }

    if (officeEmail !== '') {
      templateData.metaData.cc += officeEmail;
    }

    console.log(templateData)
    return templateData;
  }

  public async mapDataForSnsMessageBodyForSemianrRetry({ messageBodyTemplate, emailIds, placeholders, userId, fairCode, isBuyer, lang, notificationGroup, notificationType, firstName, lastName, overseasBranchOffice, lastUpdatedBy, channelType }: any) {
    const templateData = messageBodyTemplate?.data;
    const templateId = messageBodyTemplate?.data?.templateId;

    if (templateData.emailIds.length > 0) {
      templateData.emailIds.pop();
    }
    templateData.emailIds.push(emailIds);
    templateData.placeholders = placeholders;

    templateData.channels = [];
    templateData.channels.push(channelType);

    templateData.metaData.fairCode = fairCode;
    templateData.metaData.language = lang;
    templateData.metaData.notificationType = notificationGroup;
    templateData.metaData.year = new Date().getFullYear();

    if (templateId === NotificationTemplatesId.DAILY_MEETING_SUMMARY || templateId === NotificationTemplatesId.C2M_START_REMINDER || templateId === NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER) {
      templateData.queueType = 'FAST';
    } else {
      templateData.queueType =  'STANDARD';
    }

    templateData.metaData.urlLink = `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${lang}/c2m-meeting/seminar?tab=upcoming`

    templateData.metaData.firstName = firstName;
    templateData.metaData.lastName = lastName;
    
    if (isBuyer) {
      templateData.metaData.toRole = 'BUYER';
      // templateData.metaData.ssoUid = userId;
    } else {
      templateData.metaData.toRole = 'EXHIBITOR';
      // templateData.metaData.companyCcdId = userId;
    }

    console.log(templateData)
    return templateData;
  }

  public async preparePlaceHoldersAndSendToSnsForSemianrRetry({ notificationType, userData, userDetailData, templateId, fairCode, isBuyer, seminarSummaryStartRange, seminarSummaryEndRange, firstName, lastName, currFair, recommendExhibitors, notificationGroup, messageBodyTemplate, emailIds ,lang, notiTableId, seminarTableId, retryCount, channelType }: any) {
    // 1. Get fairData
    return this.fairService.getNamesObj(fairCode)
    .then((fairData: any) => {
      if (fairData.length === 0) {
        this.logger.log(JSON.stringify({ action: 'getFairData', section: `Notification - handleNotificationForSeminarSummary_${notificationType}`, step: 'error', detail: `Cannot get fairData. The fairData (${fairData}) is empty` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `Cannot get fairData. The fairData (${fairData}) is empty`
        });
      }

      // 2. Prepare dynamic words for the placeholders
      const placeholders: Promise<any>[] = [];
      placeholders.push(this.notificationService.prepareDynamicContentForSeminar(userData, userDetailData, templateId, fairCode, fairData, seminarSummaryStartRange, seminarSummaryEndRange))
      return Promise.all(placeholders)
    })
    .then(async ([placeholders]) => {
      if (placeholders === null || placeholders === undefined) {
        this.logger.log(JSON.stringify({
          action: 'mapDataForSnsMessageBody',
          section: `Notification - ${notificationType}`,
          step: 'error',
          detail: `map value for placeholders. placeholders: ${placeholders}` }));
        return {
          status: constant.COMMON_CONSTANT.FAIL,
          message: `map value for placeholders. placeholders: ${placeholders}`
        };
      }

      // 3. Prepare the message body content for SNS
      const messageBodyContent = await this.mapDataForSnsMessageBodyForSemianrRetry({
        messageBodyTemplate, 
        emailIds, 
        placeholders, 
        userId: userData.userId, 
        fairCode, 
        isBuyer, 
        lang, 
        notificationGroup,
        notificationType,
        firstName, 
        lastName,
        channelType,
      })
      console.log(messageBodyContent)
      
      return messageBodyContent;
    })
    .then(async (messageBodyContent: any) => {
      if (messageBodyContent === null || messageBodyContent === undefined) {
        this.logger.log(JSON.stringify({
          action: 'mapDataForSnsMessageBody',
          section: `Notification - ${notificationType}`,
          step: 'error',
          detail: `map value to templates fail. messageBodyContent: ${messageBodyContent}` }));
        return {
          status: constant.COMMON_CONSTANT.FAIL,
          message: `map value to templates fail. messageBodyContent: ${messageBodyContent}`
        };
      }

      // 4. Send to SNS
      const handledNotificationResult: any[] = [];
      handledNotificationResult.push(this.notificationService.sendSnsNotificationForSeminarRetry({
        userDetailData, 
        userId: userData.userId, 
        fairCode,
        fiscalYear: userData.fiscalYear,
        refEoaFairId: userData.eoaFairId,
        templateId, 
        notificationType,  
        receiverRole: messageBodyContent.metaData.toRole, 
        content: messageBodyContent,
        notiTableId,
        seminarTableId,
        retryCount,
        channelType,
      }));

      return Promise.all(handledNotificationResult);
    })
    .catch(async(error) => {
      this.logger.log(JSON.stringify({
        action: `Notification - preparePlaceHoldersAndSendToSns${notificationType} catch error`,
        section: `Notification - preparePlaceHoldersAndSendToSns_${notificationType}`,
        step: 'catch error',
        detail: `preparePlaceHoldersAndSendToSns fail. error message: ${JSON.stringify(error)}. (ssoUid: ${userData.userId}, fairCode: ${userData.fairCode}, fiscalYear: ${userData.fiscalYear})` 
      }));

      const errorRecord = await this.notificationService.createSeminarNotificationRecord({ 
        refUserId: userData.userId, 
        refFairCode: fairCode, 
        refFiscalYear: userData.fiscalYear, 
        refEoaFairId: userData.eoaFairId,
        templateId, 
        notificationType, 
        error, 
        messageBodyTemplate, 
        userDetailData,
        userData,
      })

      return {
        status: constant.COMMON_CONSTANT.FAIL,
        message: `preparePlaceHoldersAndSendToSns fail. error message: ${JSON.stringify(error)}`,
        data: {
          ssoUid: userData.userId,
          fairCode: userData.fairCode,
          fairYear: userData.fiscalYear,
          errorRecord,
        }
      }
    })
  }

  public async mapDataForSnsMessageBody({ messageBodyTemplate, emailIds, placeholders, userId, fairCode, isBuyer, lang, notificationGroup, notificationType, firstName, lastName, overseasBranchOffice, lastUpdatedBy }: any) {
    const templateData = messageBodyTemplate?.data;
    const templateId = messageBodyTemplate?.data?.templateId;

    if (templateData.emailIds.length > 0) {
      templateData.emailIds.pop();
    }
    templateData.emailIds.push(emailIds);
    templateData.placeholders = placeholders;

    templateData.metaData.fairCode = fairCode;
    templateData.metaData.language = lang;
    templateData.metaData.notificationType = notificationGroup;
    templateData.metaData.year = new Date().getFullYear();

    if (templateId === NotificationTemplatesId.DAILY_MEETING_SUMMARY || templateId === NotificationTemplatesId.C2M_START_REMINDER || templateId === NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER) {
      templateData.queueType = 'FAST';
    } else {
      templateData.queueType =  'STANDARD';
    }

    if (templateId === NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS || templateId === NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER || templateId === NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER) {
      templateData.metaData.urlLink = `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${lang}/c2m-meeting/seminar?tab=upcoming`
    } else if (templateId === NotificationTemplatesId.C2M_KICK_OFF_BUYER || templateId === NotificationTemplatesId.C2M_KICK_OFF_EXHIBITOR) {
      templateData.metaData.urlLink =  `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${lang}/c2m-meeting/dashboard`
    } else if (templateId === NotificationTemplatesId.NEW_BM_LIST || templateId === NotificationTemplatesId.UPDATED_BM_LIST || templateId === NotificationTemplatesId.NO_RESPONSE_REMINDER || templateId === NotificationTemplatesId.NOT_ENOUGH_INTEREST_REMINDER) {
      templateData.metaData.urlLink =  `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${lang}/c2m-meeting/recommendation?tab=byTDC`
    } else if (templateId === NotificationTemplatesId.DAILY_MEETING_SUMMARY || templateId === NotificationTemplatesId.C2M_START_REMINDER) {
      templateData.metaData.urlLink =  `${this.configService.get<string>('vepSite.domain')}event/${fairCode}/${lang}/c2m-meeting/meeting?tab=upcoming`
    }

    templateData.metaData.firstName = firstName;
    templateData.metaData.lastName = lastName;
    
    if (isBuyer) {
      templateData.metaData.toRole = 'BUYER';
      // templateData.metaData.ssoUid = userId;
    } else {
      templateData.metaData.toRole = 'EXHIBITOR';
      // templateData.metaData.companyCcdId = userId;
    }

    let officeEmail = '';
    let bmSpecialistEmail = '';
    if (templateId === NotificationTemplatesId.NEW_BM_LIST ||
        templateId === NotificationTemplatesId.UPDATED_BM_LIST ||
        templateId === NotificationTemplatesId.NO_RESPONSE_REMINDER
    ) {
        const query = `SELECT * FROM vep_content.vep_council_global_office where office_code = '${overseasBranchOffice}'`;

        const connection = await getConnection('contentDatabase');
        const slaveRunner = connection.createQueryRunner('slave');
        let relatedOfficeInfo: any;
        try {
          relatedOfficeInfo = await connection.query(query, undefined, slaveRunner);
        } catch (error) {
          console.log("Error in preparePlaceHoldersAndSendToSnsForSemianrRetry api", error)
        } finally {
          slaveRunner.release();
        }

        officeEmail = relatedOfficeInfo?.[0]?.email || '';
    }

    if (templateId === NotificationTemplatesId.NEW_BM_LIST || templateId === NotificationTemplatesId.UPDATED_BM_LIST) {
      bmSpecialistEmail = lastUpdatedBy || '';
    }

    if (officeEmail !== '' || bmSpecialistEmail !== '') {
      templateData.metaData.cc += officeEmail
      templateData.metaData.cc === '' ? templateData.metaData.cc += bmSpecialistEmail : templateData.metaData.cc = templateData.metaData.cc + ', ' + bmSpecialistEmail
    }

    console.log(templateData)
    return templateData;
  }

  public async preparePlaceHoldersAndSendToSns({ notificationType, userData, userDetailData, templateId, fairCode, isBuyer, seminarSummaryStartRange, seminarSummaryEndRange, firstName, lastName, currFair, recommendExhibitors, notificationGroup, messageBodyTemplate, emailIds ,lang }: preparePlaceHoldersAndSendToSns) {
    // 1. Get fairData
    return this.fairService.getNamesObj(fairCode)
    .then((fairData: any) => {
      if (fairData.length === 0) {
        this.logger.log(JSON.stringify({ action: 'getFairData', section: `Notification - handleNotificationForSeminarSummary_${notificationType}`, step: 'error', detail: `Cannot get fairData. The fairData (${fairData}) is empty` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `Cannot get fairData. The fairData (${fairData}) is empty`
        });
      }

      // 2. Prepare dynamic words for the placeholders
      const placeholders: Promise<any>[] = [];
      if (templateId === NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS || templateId === NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER || templateId === NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER) {
        placeholders.push(this.notificationService.prepareDynamicContentForSeminar(userData, userDetailData, templateId, fairCode, fairData, seminarSummaryStartRange, seminarSummaryEndRange))
      } else if (templateId === NotificationTemplatesId.C2M_KICK_OFF_BUYER || templateId === NotificationTemplatesId.C2M_KICK_OFF_EXHIBITOR) {
        placeholders.push(this.notificationService.prepareDynamicContentForKickOFF(userDetailData, templateId, currFair, recommendExhibitors))
      } else if (templateId === NotificationTemplatesId.DAILY_MEETING_SUMMARY || templateId === NotificationTemplatesId.C2M_START_REMINDER) {
        placeholders.push(this.notificationService.prepareDynamicContentForSummary(userDetailData, templateId, userData.userId))
      }
      return Promise.all(placeholders)
    })
    .then(async ([placeholders]) => {
      if (placeholders === null || placeholders === undefined) {
        this.logger.log(JSON.stringify({
          action: 'mapDataForSnsMessageBody',
          section: `Notification - ${notificationType}`,
          step: 'error',
          detail: `map value for placeholders. placeholders: ${placeholders}` }));
        return {
          status: constant.COMMON_CONSTANT.FAIL,
          message: `map value for placeholders. placeholders: ${placeholders}`
        };
      }

      // 3. Prepare the message body content for SNS
      const messageBodyContent = await this.mapDataForSnsMessageBody({
        messageBodyTemplate, 
        emailIds, 
        placeholders, 
        userId: userData.userId, 
        fairCode, 
        isBuyer, 
        lang, 
        notificationGroup,
        notificationType,
        firstName, 
        lastName,
      })
      console.log(messageBodyContent)
      
      return messageBodyContent;
    })
    .then(async (messageBodyContent: any) => {
      if (messageBodyContent === null || messageBodyContent === undefined) {
        this.logger.log(JSON.stringify({
          action: 'mapDataForSnsMessageBody',
          section: `Notification - ${notificationType}`,
          step: 'error',
          detail: `map value to templates fail. messageBodyContent: ${messageBodyContent}` }));
        return {
          status: constant.COMMON_CONSTANT.FAIL,
          message: `map value to templates fail. messageBodyContent: ${messageBodyContent}`
        };
      }

      // 4. Send to SNS
      const handledNotificationResult: any[] = [];
      handledNotificationResult.push(this.notificationService.sendSnsNotificationCenter({
        userDetailData, 
        userId: userData.userId, 
        fairCode,
        fiscalYear: userData.fiscalYear,
        refEoaFairId: userData.eoaFairId,
        templateId, 
        notificationType,  
        receiverRole: messageBodyContent.metaData.toRole, 
        content: messageBodyContent
      }));

      return Promise.all(handledNotificationResult);
    })
    .catch(async (error) => {
      this.logger.log(JSON.stringify({
        action: `Notification - preparePlaceHoldersAndSendToSns${notificationType} catch error`,
        section: `Notification - preparePlaceHoldersAndSendToSns_${notificationType}`,
        step: 'catch error',
        detail: `preparePlaceHoldersAndSendToSns fail. error message: ${JSON.stringify(error)}. (ssoUid: ${userData.userId}, fairCode: ${userData.fairCode}, fiscalYear: ${userData.fiscalYear})` 
      }));

      const promiseArray = this.notificationService.createNotificationErrorRecordCenter({ 
        refUserId: userData.userId, 
        refFairCode: fairCode, 
        refFiscalYear: userData.fiscalYear, 
        refEoaFairId: userData.eoaFairId,
        templateId, 
        notificationType, 
        error, 
        messageBodyTemplate, 
        userDetailData,
        userData,
      })

      const promiseArrayResult = await Promise.all(promiseArray);

      return {
        status: constant.COMMON_CONSTANT.FAIL,
        message: `preparePlaceHoldersAndSendToSns fail. error message: ${JSON.stringify(error)}`,
        data: {
          ssoUid: userData.userId,
          fairCode: userData.fairCode,
          fairYear: userData.fiscalYear,
          promiseArrayResult
        }
      }
    })
  }

  // ------------------------------------------------ End of Center Function of R3 Notification --------------------------------- //
  // ------------------------------------------------ Meeting Summary Notification ---------------------------------------------- //

  /*
  /*  Handle below notifications:
  /*  1. DAILY_MEETING_SUMMARY
  /*  2. C2M_START_REMINDER
  */
  public async handleNotificationForSummary({ userData, currFair, summaryDate, messageBodyTemplate }: handleNotificationSummary) {
    let templateId: number;
    let notificationType: string;
    let searchByDate: any;

    if (summaryDate != null) {
      templateId = NotificationTemplatesId.DAILY_MEETING_SUMMARY;
      notificationType = `${NotificationType.DAILY_MEETING_SUMMARY}_${summaryDate}`;

      const currentTimeHKTStart = `${summaryDate}00:00:00`;
      const currentTimeHKTEnd = `${summaryDate}23:59:59`;
      const todayStart = moment.tz(currentTimeHKTStart, 'YYYY-MM-DD HH:mm:ss', 'Asia/Hong_Kong').utc().format('YYYY-MM-DD HH:mm:ss');
      const todayEnd = moment.tz(currentTimeHKTEnd, 'YYYY-MM-DD HH:mm:ss', 'Asia/Hong_Kong').utc().format('YYYY-MM-DD HH:mm:ss');
      searchByDate = `AND startTime >= '${todayStart}' AND endTime <= '${todayEnd}'`;
    } else {
      templateId = NotificationTemplatesId.C2M_START_REMINDER;
      notificationType = NotificationType.C2M_START_REMINDER;
      searchByDate = '';
    }

    try {
      // get related meeting belong to userId ( SSOUID/  CCDID) and fairCode and fiscalYear
      let query = `
      
      SELECT   

        buyerSsoUid 
        ,buyer.emailId as buyerEmail
        ,buyerFairCode 
        ,eoa_fsn_buyer.meta_value as buyerFairShortName
        ,buyerFiscalYear 
        ,registration.firstName as buyerFirstName
        ,registration.lastName  as buyerLastName
        ,registration.companyName as buyerCompanyName 
        ,registration.addressCountryCode as buyerCountryCode
        ,CONCAT(registration.serialNumber, SUBSTRING(registration.projectYear, 3, 2), registration.sourceTypeCode, registration.visitorTypeCode, registration.projectNumber) AS registrationNo 
        ,buyerCountryList.english_description as buyerCountryEN
        ,buyerCountryList.chinese_description_tc as buyerCountryTC
        ,buyerCountryList.chinese_description_sc as buyerCountrySC
        ,buyer.preferredLanguage  as buyerPreferredLanguage
        ,buyer.userTimezone  as buyerTimezone
        ,exhibitorSsoUid 
        ,exhibitorFairCode 
        ,eoa_fsn_exhibitor.meta_value as exhibitorFairShortName
        ,exhibitorFiscalYear   
        ,exhibitor.contactEmail as exhibitorEmail
        ,exhibitor.firstName as exhibitorFirstName
        ,exhibitor.lastName  as exhibitorLastName  
        ,exhibitor.contactName  as exhibitorContactName
        ,exhibitor.companyName  as exhibitorcompanyName
        ,exhibitor.country as exhibitorCountryCode
        ,exhibitorCountryList.english_description as exhibitorCountryEN
        ,exhibitorCountryList.chinese_description_tc as exhibitorCountryTC
        ,exhibitorCountryList.chinese_description_sc as exhibitorCountrySC
        , IFNULL( exhibitorPreferredLanguage.preferredLanguage,  'en') as exhibitorPreferredLanguage 
        , IFNULL( exhibitor.userTimezone,  'Asia/Hong_Kong') as exhibitorUserTimezone
        ,filterMeetingList.*
    
      FROM
      ( 
        SELECT
        * ,
          CASE
          WHEN requesterRole = 'BUYER' THEN requesterSsoUid
          ELSE responderSsoUid
        END AS buyerSsoUid, 
          
          CASE
          WHEN requesterRole = 'BUYER' THEN fairCode
          ELSE responderFairCode
        END AS buyerFairCode, 
          
          CASE
          WHEN requesterRole = 'BUYER' THEN fiscalYear
          ELSE responderfiscalYear
        END AS buyerFiscalYear, 
          
          CASE
          WHEN requesterRole = 'EXHIBITOR' THEN requesterSsoUid
          ELSE responderSsoUid
        END AS exhibitorSsoUid,
          
          CASE
          WHEN requesterRole = 'EXHIBITOR' THEN fairCode
          ELSE responderFairCode
        END AS exhibitorFairCode, 
          
          CASE
          WHEN requesterRole = 'EXHIBITOR' THEN fiscalYear
          ELSE responderfiscalYear
        END AS exhibitorFiscalYear         
    
      FROM vep_c2m_service_db.vepC2MMeeting
      WHERE 
        status = ${MeetingStatus.ACCEPTED}  
        AND  
        (
          ( 
            responderSsoUid  = '${userData.userId}' 
            AND responderFairCode  in (${currFair.fairCodeSQL}) 
            AND responderFiscalYear in (${currFair.fiscalYearSQL}) 
          ) 
          OR 
          (
            requesterSsoUid = '${userData.userId}' 
            AND fairCode in (${currFair.fairCodeSQL}) 
            AND fiscalYear in (${currFair.fiscalYearSQL}) 
          ) 
        )  

        ${searchByDate}
        
      ) filterMeetingList
      
      LEFT JOIN vepFairDb.fairParticipant participant ON participant.ssoUid = filterMeetingList.buyerSsoUid
      LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id AND registration.fairCode = filterMeetingList.buyerFairCode AND registration.fiscalYear = filterMeetingList.buyerFiscalYear 
      LEFT JOIN vepBuyerDb.vepBuyer buyer ON buyer.ssoUid = filterMeetingList.buyerSsoUid  
      LEFT JOIN vep_content.vep_fair_setting eoa ON eoa.meta_key = 'eoa_fair_id' AND eoa.fairCode = filterMeetingList.exhibitorFairCode AND eoa.fiscal_year = filterMeetingList.exhibitorFiscalYear
      LEFT JOIN vepExhibitorDb.vepExhibitor exhibitor  ON  exhibitor.companyCcdId = filterMeetingList.exhibitorSsoUid AND exhibitor.eoaFairId = eoa.meta_value
      LEFT JOIN vep_content.vep_fair_setting eoa_fsn_exhibitor ON eoa_fsn_exhibitor.meta_key = 'fair_short_name' AND eoa_fsn_exhibitor.fairCode = filterMeetingList.exhibitorFairCode AND eoa_fsn_exhibitor.fiscal_year = filterMeetingList.exhibitorFiscalYear
      LEFT JOIN vep_content.vep_fair_setting eoa_fsn_buyer ON eoa_fsn_buyer.meta_key = 'fair_short_name' AND eoa_fsn_buyer.fairCode = filterMeetingList.buyerFairCode AND eoa_fsn_buyer.fiscal_year = filterMeetingList.buyerFiscalYear
      LEFT JOIN vepBuyerDb.vepBuyer exhibitorPreferredLanguage ON exhibitorPreferredLanguage.emailId = exhibitor.contactEmail
      LEFT JOIN vep_content.vep_council_global_country buyerCountryList ON buyerCountryList.code = registration.addressCountryCode
      LEFT JOIN vep_content.vep_council_global_country exhibitorCountryList ON exhibitorCountryList.code = exhibitor.country


      ORDER BY filterMeetingList.startTime ASC
        
        `;

      console.log(query)

      const connection = await getConnection('contentDatabase');
      const slaveRunner = connection.createQueryRunner('slave');
      let meeting: any;
      try {
        meeting = await connection.query(query, undefined, slaveRunner);
      } catch (error) {
        console.log("Error in handleNotificationForSummary api", error)
      } finally {
        slaveRunner.release();
      }

      if (meeting.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target meeting', section: 'Notification - handleNotificationForSummary', step: 'error', detail: `target meeting detail data cannot be found in content db: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})` }));
        throw `target meeting detail data cannot be found in content db (no target buyer found fairCode: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})`;
      }

      // 1. Prepare the target user detail
      let firstMeetingData = meeting[0];
      let fairCode: string;
      let fiscalYear: string;
      let userEmailAddress: string;
      let firstName: string;
      let lastName: string;
      let isBuyer: boolean;
      let userPreferredLanguage: string;
      if (userData.userId === firstMeetingData.buyerSsoUid) {
        fairCode = firstMeetingData.buyerFairCode;
        fiscalYear = firstMeetingData.buyerFiscalYear;
        userEmailAddress = firstMeetingData.buyerEmail;
        firstName = firstMeetingData?.buyerFirstName;
        lastName = firstMeetingData?.buyerLastName;
        isBuyer = true;
        userPreferredLanguage = firstMeetingData.buyerPreferredLanguage;
      } else {
        fairCode = firstMeetingData.exhibitorFairCode;
        fiscalYear = firstMeetingData.exhibitorFiscalYear;
        userEmailAddress = firstMeetingData.exhibitorEmail;
        firstName = firstMeetingData?.exhibitorFirstName;
        lastName = firstMeetingData?.exhibitorLastName;
        isBuyer = false;
        userPreferredLanguage = firstMeetingData.exhibitorPreferredLanguage;
      }

      // 2. Throw error, if one of the target user details are null
      if (!firstMeetingData || !userData.userId || !fairCode || !fiscalYear || !userEmailAddress) {
        this.logger.log(JSON.stringify({ action: 'prepare the meeting detail', section: `Notification - handleNotificationForSummary`, step: 'error', detail: `meeting data get fail. The meetingData: ${JSON.stringify(firstMeetingData)}` }));
        throw `meeting data get fail. The meetingData: ${JSON.stringify(firstMeetingData)}`;
      }

      // 3. Prepare the messageBody and send to SNS
      const handleNotiResult = await this.preparePlaceHoldersAndSendToSns({
        notificationType,
        userData,
        userDetailData: meeting,
        templateId,
        fairCode,
        isBuyer,
        firstName,
        lastName,
        currFair,
        notificationGroup: notificationGroup.MEETINGS,
        messageBodyTemplate,
        emailIds: userEmailAddress,
        lang: userPreferredLanguage,
      })
      
      return handleNotiResult;
    } catch (error) {
      // insert to noti DB for error case, so that it wont find when left JOIN noti table
      return this.notificationService.createNotificationRecordInC2mDb(({
        meetingId: 0,
        refUserId: userData.userId,
        refFairCode: currFair.fairCodeString,
        refFiscalYear: currFair.fiscalYearString,
        templateId,
        channelType: ChannelType.EMAIL,
        notificationType,
        receiverRole: 'ERROR',
        notificationContent: `ERROR: ${error}`,
        status: 1,
      }));
    }
  }

  // ------------------------------------------------ End of Meeting Summary Notification ----------------------------------------- //
  // ------------------------------------------------ Kick Off Notification ------------------------------------------------ //

  /*
  /*  Handle below notifications:
  /*  1. C2M_KICK_OFF_EXHIBITOR
  /*  2. C2M_KICK_OFF_BUYER
  */
  public async handleNotificationForKickOff({ templateId, notificationType, receiverRole, userData, currFair, messageBodyTemplate, recommendExhibitors }: handleNotificationKickOff): Promise<any> {
    try {
      // 1. Prepare the target user detail
      let userId: string;
      let fairCode: string;
      let fiscalYear: string;
      let userEmailAddress: string;
      let userDetailData: any;
      let firstName: string;
      let lastName: string;
      let isBuyer: boolean;
      let query: string;
      let targetUsers: any;
  
      if (receiverRole === ReceiverRole.EXHIBITOR) {
        query = `
          SELECT 
            eoa.fairCode, 
            eoa.fiscal_year, 
            eoa.meta_value as eoa_fair_id,
            exhibitor.contactEmail AS userEmail,
            exhibitor.companyCcdid AS userId,
            exhibitor.firstName, 
            exhibitor.lastName,
            exhibitor.companyName,
            exhibitor.c2mLogin, 
            exhibitor.c2mMeetingLogin,  
            exhibitorCountryList.english_description as exhibitorCountryEN, 
            exhibitorCountryList.chinese_description_tc as exhibitorCountryTC, 
            exhibitorCountryList.chinese_description_sc as exhibitorCountrySC,
            IFNULL(exhibitorPreference.preferredLanguage, 'en') as preferredLanguage, 
            IFNULL(exhibitorPreferredChannel.email, '0') as exhibitorReceiveEmail  
          FROM 
            vepExhibitorDb.vepExhibitor exhibitor 
            LEFT JOIN vep_content.vep_fair_setting eoa ON eoa.meta_key = 'eoa_fair_id'  AND exhibitor.eoaFairId = eoa.meta_value
            LEFT JOIN vep_content.vep_council_global_country exhibitorCountryList ON exhibitorCountryList.code = exhibitor.country 
            LEFT JOIN vepBuyerDb.vepBuyer exhibitorPreference ON exhibitorPreference.emailId = exhibitor.contactEmail
            LEFT JOIN vepBuyerDb.vepPreferredChannel exhibitorPreferredChannel ON exhibitorPreferredChannel.id = exhibitorPreference.preferredChannelId 
          WHERE 
            exhibitor.companyCcdId is not NULL 
            AND exhibitor.deletionTime < '1980-01-01 00:00:00' 
            AND exhibitor.vepExhibitorRegistrationStatusId = 1 
            AND exhibitor.c2mParticipantStatusId = 1  
            AND exhibitor.c2mLogin is null
            AND eoa.fairCode = '${currFair.fairCodeSingle}'
            AND eoa.meta_value = '${userData.eoaFairId}'
            AND exhibitor.companyCcdid = '${userData.userId}'         
        `;
        console.log(query);
        const connection = await getConnection('contentDatabase');
        const slaveRunner = connection.createQueryRunner('slave');
        let targetUsers: any;
        try {
          targetUsers = await connection.query(query, undefined, slaveRunner);
        } catch (error) {
          console.log("Error in handleNotificationForKickOff api", error)
        } finally {
          slaveRunner.release();
        }

        if (targetUsers.length === 0) {
          this.logger.log(JSON.stringify({ action: 'get target fair', section: 'handleKickOffExhibitorReminder', step: 'error', detail: `target exhibitor detail data cannot be found in content db: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})` }));
          throw `target exhibitor detail data cannot be found in content db: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})`;
        }
        userDetailData = targetUsers[0];
        userId = userData?.userId;
        fairCode = userDetailData?.fairCode;
        fiscalYear = userDetailData?.fiscal_year;
        userEmailAddress = userDetailData?.userEmail;
        firstName = userDetailData?.firstName;
        lastName = userDetailData?.lastName;
        isBuyer = false;
      } else {
        query = `
        Select 
          registration.fairCode, 
          registration.fiscalYear, 
          participant.emailId AS userEmail, 
          registration.firstName, 
          registration.lastName, 
          registration.c2mLogin, 
          registration.c2mMeetingLogin, 
          registration.companyName, 
          registration.addressCountryCode as buyerCountryCode, 
          buyerCountryList.english_description as buyerCountryEN, 
          buyerCountryList.chinese_description_tc as buyerCountryTC, 
          buyerCountryList.chinese_description_sc as buyerCountrySC, 
          IFNULL( buyer.preferredLanguage,  'en') as preferredLanguage,
          IFNULL( buyerPreferredChannel.email, '0') as buyerReceiveEmail 
        FROM 
          vepFairDb.fairRegistration registration 
          INNER JOIN vepFairDb.fairParticipant participant ON participant.id = registration.fairParticipantId 
          LEFT JOIN vepBuyerDb.vepBuyer buyer ON buyer.ssoUid = participant.ssoUid 
          LEFT JOIN vep_content.vep_council_global_country buyerCountryList ON buyerCountryList.code = registration.addressCountryCode 
          LEFT JOIN vepBuyerDb.vepPreferredChannel buyerPreferredChannel ON buyerPreferredChannel.id = buyer.preferredChannelId 
        WHERE 
          registration.fairCode = '${userData.fairCode}' 
          AND registration.fiscalYear = '${userData.fiscalYear}'
          AND participant.ssoUid = '${userData.userId}'
          AND registration.c2mLogin is null
          AND participant.deletionTime <= '1980-01-01 00:00:00'   
          AND registration.deletionTime <= '1980-01-01 00:00:00'  
          AND registration.fairRegistrationStatusId = 1 
          AND (registration.c2mParticipantStatusId = 1 OR registration.c2mParticipantStatusId = 2 OR registration.c2mParticipantStatusId = 3) 
        `;
        console.log(query);
        const connection = await getConnection('contentDatabase');
        const slaveRunner = connection.createQueryRunner('slave');
        let targetUsers: any;
        try {
          targetUsers = await connection.query(query, undefined, slaveRunner);
        } catch (error) {
          console.log("Error in handleNotificationForKickOff api", error)
        } finally {
          slaveRunner.release();
        }

        if (targetUsers.length === 0) {
          this.logger.log(JSON.stringify({ action: 'get target fair', section: 'handleKickOffBuyerReminder', step: 'error', detail: `target buyer detail data cannot be found in content db: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})` }));
          throw `target buyer detail data cannot be found in content db (no target buyer found fairCode: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})`;
        }
        userDetailData = targetUsers[0];
        userId = userData?.userId;
        fairCode = userDetailData?.fairCode;
        fiscalYear = userDetailData?.fiscalYear;
        userEmailAddress = userDetailData?.userEmail;
        firstName = userDetailData?.firstName;
        lastName = userDetailData?.lastName;
        isBuyer = true;
      }
  
      // 2. Throw error, if one of the target user details are null
      if (!userDetailData || !userId || !fairCode || !fiscalYear || !userEmailAddress) {
        this.logger.log(JSON.stringify({ action: 'prepare the target user detail', section: `Notification - handleNotificationForSeminarSummary_${notificationType}`, step: 'error', detail: `user data get fail. The userData: ${JSON.stringify(userData)}` }));
        throw `user data get fail. The userData: ${JSON.stringify(userData)}`;
      }

      // 3. Prepare the messageBody and send to SNS
      const handleNotiResult = await this.preparePlaceHoldersAndSendToSns({
        notificationType,
        userData,
        userDetailData: targetUsers,
        templateId,
        fairCode,
        isBuyer,
        firstName,
        lastName,
        currFair,
        recommendExhibitors,
        notificationGroup: notificationGroup.FAIR,
        messageBodyTemplate,
        emailIds: userData.emailId,
        lang: targetUsers[0].preferredLanguage,
      })
      
      return handleNotiResult;

    } catch (error) {
      this.logger.log(JSON.stringify({ action: 'catch error', section: 'handleKickOffBuyerReminder', step: 'error', detail: `${error ?? JSON.stringify(error)}` }));

      let promiseArray;
      if (receiverRole === ReceiverRole.EXHIBITOR) {
        promiseArray = this.notificationService.createNotificationErrorRecordCenter({
          refUserId: userData.userId, 
          refEoaFairId: userData.eoaFairId,
          templateId, 
          notificationType, 
          error, 
          messageBodyTemplate: messageBodyTemplate.data, 
        })
      } else {
        promiseArray = this.notificationService.createNotificationErrorRecordCenter({
          refUserId: userData.userId, 
          refFairCode: currFair.fairCodeString,
          refFiscalYear: currFair.fiscalYearString, 
          templateId, 
          notificationType, 
          error, 
          messageBodyTemplate: messageBodyTemplate.data, 
        })
      }
      const promiseArrayResult = await Promise.all(promiseArray);

      return {
        status: 400,
        message: error ?? JSON.stringify(error),
        data: {
          promiseArrayResult,
        }
      };
    }
  }

  // ------------------------------------------------ End of Kick Off Notification ------------------------------------------------ //
  // ------------------------------------------------ Seminar Notification ------------------------------------------------ //

  /*
  /*  Handle below notifications:
  /*  1. SEMINAR_REGISTRATION_SUCCESS
  /*  2. SEMINAR_SUMMARY_REMINDER
  /*  3. SEMINAR_ATTENDING_REMINDER
  */
  public async seminarRegistrationReminder(userId: string, fairCode: string, fiscalYear: string, eventId: string, seminarId: any[], messageBodyTemplate: any): Promise<any> {
    this.logger.log(JSON.stringify({ action: '1st line in this func', section: 'seminarRegistrationReminder', step: '1', detail: `input: ${userId}, ${fairCode}, ${fiscalYear}, ${eventId}, ${seminarId}` }));

    let userDetailDataForCreatingRecord: Record<string, any> | null = null;
    // 1. Get the corresponding 'vms_project_no' and 'vms_project_year' for the target fairs
    let queryForVmsInfo = `
      SELECT
        filterList.faircode,
        filterList.fiscal_year,
        MIN(filterList.vms_project_no) AS vms_project_no,
        MIN(filterList.vms_project_year) AS vms_project_year
      FROM
      (
        SELECT
          faircode,
          fiscal_year,
          IF (fair_setting.meta_key = 'vms_project_no', meta_value, null )  AS vms_project_no,
          IF (fair_setting.meta_key = 'vms_project_year', meta_value, null )  AS vms_project_year
        FROM vep_content.vep_fair_setting fair_setting
          WHERE (meta_key = 'vms_project_no' OR meta_key = 'vms_project_year')
          AND fairCode = '${fairCode}'
          AND fiscal_year = ${fiscalYear}
      ) filterList
      group by faircode, fiscal_year
    `;

    console.log(queryForVmsInfo)

    this.logger.log(JSON.stringify({ action: 'get vms info', section: 'seminarRegistrationReminder', step: 'query', detail: `${queryForVmsInfo}` }));

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');

    return connection.query(queryForVmsInfo, undefined, slaveRunner)
    .then(async (targetVmsInfo: any) => {
      if (targetVmsInfo.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get vms info', section: 'seminarRegistrationReminder', step: 'error', detail: `no vms info got. error response: ${JSON.stringify(targetVmsInfo)}` }));
        return Promise.reject({
          status: 400,
          message: `no vms info got. error response: ${JSON.stringify(targetVmsInfo)}`
        });
      }
      this.logger.log(JSON.stringify({ action: 'get vms info', section: 'seminarRegistrationReminder', step: '1', detail: `targetVmsInfo: ${JSON.stringify(targetVmsInfo)}` }));

      // 2. Get the target users list with user detail (conditions: userId, fairCode, fiscalYear, emailNotiStatus = 0 OR webNotiStatus = 0)
      // * include retry mechanism
      let whereConditionsSeminarId = '';
      for (let i = 0; i < seminarId.length; i++) {
        if (i === 0) {
          whereConditionsSeminarId += ` seminarRegistration.seminarId = '${seminarId[i]}' `;
        } else {
          whereConditionsSeminarId += ` OR seminarRegistration.seminarId = '${seminarId[i]}' `;
        }
      }

      let queryForTagetUserWithDetails = `
        SELECT
          seminarRegistration.id,
          seminarRegistration.userId,
          seminarRegistration.fairCode,
          seminarRegistration.fiscalYear,
          seminarRegistration.eventId,
          seminarRegistration.seminarId,
          seminarRegistration.emailNotiStatus,
          seminarRegistration.webNotiStatus,
          seminarRegistration.source,
          seminarRegistration.creationTime,
          participant.emailId as userEmail,
          registration.firstName as firstName,
          registration.lastName as lastName
        FROM
          vepFairDb.vepFairSeminarRegistration seminarRegistration
        LEFT JOIN vepFairDb.fairParticipant participant ON participant.ssoUid = seminarRegistration.userId
        LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id AND registration.fairCode = seminarRegistration.fairCode AND registration.fiscalYear = seminarRegistration.fiscalYear
        WHERE 
          (emailNotiStatus = 0 
          OR webNotiStatus = 0)
          AND (seminarRegistration.userId = '${userId}' AND seminarRegistration.fairCode = '${fairCode}' AND seminarRegistration.fiscalYear = '${fiscalYear}' AND seminarRegistration.eventId = '${eventId}' AND (${whereConditionsSeminarId}))
          ORDER BY id ASC
      `;
      // LIMIT ${this.scheduleJobLimitSeminarRegistration}
      // LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id

      console.log(queryForTagetUserWithDetails);
      await this.wait(60000);
      this.logger.log(JSON.stringify({ action: 'get target user info', section: 'seminarRegistrationReminder', step: 'query', detail: `${queryForTagetUserWithDetails}` }));
      
      const tagetUserWithDetails = await getConnection('buyerDatabaseForWrite').query(queryForTagetUserWithDetails)

      return Promise.all([
        targetVmsInfo, 
        tagetUserWithDetails
      ]);
    })
    .then(async ([targetVmsInfo, tagetUserWithDetails]: any) => {
      if (tagetUserWithDetails.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target user info', section: 'handleSeminarRegistrationReminder', step: 'error', detail: `get target user info fails(${userId}, ${fairCode}, ${fiscalYear}, ${eventId}, ${seminarId}). error response: ${JSON.stringify(tagetUserWithDetails)}, error response: ${tagetUserWithDetails}` }));
        return Promise.reject({
          status: 400,
          message: `get target user info fails. error response: ${JSON.stringify(tagetUserWithDetails)}`
        });
      }

      if (tagetUserWithDetails[0].userEmail === null || tagetUserWithDetails[0].userEmail === undefined ) {
        this.logger.log(JSON.stringify({ action: 'get target user email', section: 'seminarRegistrationReminder', step: 'error', detail: `get target user emails fails. error response: ${JSON.stringify(tagetUserWithDetails[0].userEmail)}, error response: ${tagetUserWithDetails}` }));
        return Promise.reject({
          status: 400,
          message: `get target user emails fails. error response: ${JSON.stringify(tagetUserWithDetails)}`
        });
      }
      userDetailDataForCreatingRecord = tagetUserWithDetails;

      this.logger.log(JSON.stringify({ action: 'get target user info', section: 'seminarRegistrationReminder', step: '2', detail: `tagetUserWithDetails: ${JSON.stringify(tagetUserWithDetails)}` }));

      // handle lang input for SBE API
      
      const langResult = await this.buyerService.getTimezoneAndPreferredLang(fairCode, userId, tagetUserWithDetails[0]?.userEmail)
      if (langResult.status !== 200 || langResult === undefined || langResult === null) {
        this.logger.log(JSON.stringify({ action: 'get target user lang', section: 'seminarRegistrationReminder', step: 'error', detail: `get target user lang fails. error response: ${JSON.stringify(tagetUserWithDetails.userEmail)}, error response: ${tagetUserWithDetails}` }));
        return Promise.reject({
          status: 400,
          message: `get target user lang fails. error response: ${JSON.stringify(tagetUserWithDetails)}`
        });
      }

      let langInput;
      const preLang = langResult.data.preferredLanguage
      if (preLang === 'tc') {
        langInput = 'zh';
      } else if (preLang === 'sc') {
        langInput = 'cn';
      } else {
        langInput = 'en';
      }

      // 3. Call SBE API
      const allSeminarsPromise: Promise<any>[] = [];
      allSeminarsPromise.push(
        this.fairService
          .findAllSeminars(targetVmsInfo[0].vms_project_no, targetVmsInfo[0].vms_project_year, 'VEP', langInput)
          .catch(async (error: any) => {
            this.logger.log(JSON.stringify({
              action: 'call SBE API',
              section: 'seminarRegistrationReminder',
              step: 'error',
              detail: {
                vmsProjectNo: targetVmsInfo[0].vms_project_no,
                vmsProjectYear: targetVmsInfo[0].vms_project_year,
                lenguage: preLang,
                status: error?.status ?? 400,
                message: error?.message ?? JSON.stringify(error)
              }
            }));
            return Promise.reject({
              status: error?.status ?? 400,
              message: error?.message ?? JSON.stringify(error)
            });
          })
      );

      const allSeminars: any = await Promise.all(allSeminarsPromise);

      // console.log(allSeminars[0].data.data);
      this.logger.log(JSON.stringify({ action: 'call SBE API', section: 'seminarRegistrationReminder', step: '3', detail: `allSeminars: ${JSON.stringify(allSeminars[0].data.data)}` }));

      return Promise.all([allSeminars, tagetUserWithDetails, preLang]);
    })
    .then(async ([allSeminars, tagetUserWithDetails, preLang]: any[]) => {
      // 4. filter all status 400 return result from this.fairService.findAllSeminars()
      let successSeminars;
      successSeminars = allSeminars.filter((seminar: any) => seminar.status === 200);
      // console.log(successSeminars[0]);
      this.logger.log(JSON.stringify({ action: 'successSeminars', section: 'seminarRegistrationReminder', step: '4', detail: `successSeminars: ${JSON.stringify(successSeminars[0].data.data)}` }));

      if (successSeminars.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get success seminar detail', section: 'seminarRegistrationReminder', step: 'error', detail: 'no success seminar data got, after calling SBE API' }));
        return Promise.reject({
          status: 400,
          message: 'no success seminar data got, after calling SBE API'
        });
      }

      return Promise.all([successSeminars, tagetUserWithDetails, preLang]);
    })
    .then(async ([successSeminars, tagetUserWithDetails, preLang]: any[]) => {
      // 5. Loop the targetUsers list and allSeminars to map the data noti need
      const userWithSeminarsArray: any[] = [];
      let seminarsFilteredTempList: any;
      tagetUserWithDetails.forEach((user: any) => {
        successSeminars.forEach((eventList: any) => {
          seminarsFilteredTempList = eventList?.data?.data.filter((seminar: any) => user.eventId === seminar.eventId && user.seminarId === seminar.id);
          if (seminarsFilteredTempList.length !== 0) {
            userWithSeminarsArray.push({
              id: user?.id,
              userId: user?.userId,
              userEmail: user?.userEmail,
              firstName: user?.firstName,
              lastName: user?.lastName,
              preferredLanguage: preLang || 'en',
              fairCode: user?.fairCode,
              fairYear: user?.fairYear,
              eventId: user?.eventId,
              seminarId: user?.seminarId,
              seminarStartTime: seminarsFilteredTempList[0]?.startAt,
              seminarType: seminarsFilteredTempList[0]?.type,
              seminarName: seminarsFilteredTempList[0]?.name,
              seminarLocation: seminarsFilteredTempList[0]?.location,
              source: user.source,
              creationTime: user.creationTime
            });
          }
        });
      });

      this.logger.log(JSON.stringify({ action: 'userWithSeminarsArray', section: 'handleSeminarRegistrationReminder', step: '5', detail: `userWithSeminarsArray: ${JSON.stringify(userWithSeminarsArray)}` }));
      // console.log(userWithSeminarsArray);
      return Promise.all(userWithSeminarsArray);
    })
    .then(async (userWithSeminarsArray: any) => {
      // 7. Group the target seminarRecordId (same ssoUid, fairCode and fairYear) to 'registration form' or 'intelligence hub' (distingish short form or long form seminar registration)
      if (userWithSeminarsArray.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target users with seminar data', section: 'handleSeminarSummaryReminder', step: 'error', detail: 'cannot get the target users with seminar data after filtering' }));
        return {
          status: 400,
          message: 'cannot get the target users with seminar data after filtering'
        };
      }

      let whereConditions = '';
      for (let i = 0; i < userWithSeminarsArray.length; i++) {
        console.log(userWithSeminarsArray[i].length);
        if (i === 0) {
          whereConditions += ` seminarRegistration.id = '${userWithSeminarsArray[i].id}' `;
        } else {
          whereConditions += ` OR seminarRegistration.id = '${userWithSeminarsArray[i].id}' `;
        }
      }
      console.log(whereConditions);

      let queryForTagetUsers = `
        SELECT 
          seminarRegistration.*
          ,participant.emailId as userEmail
          ,registration.firstName as firstName
          ,registration.lastName as lastName
        FROM 
        (
            SELECT
              id,
              userId,
              fairCode,
              fiscalYear,
              eventId,
              seminarId,
              userRole,
              emailNotiStatus,
              webNotiStatus,
              source,
              creationTime
            FROM 
              vepFairDb.vepFairSeminarRegistration
            WHERE 
              (emailNotiStatus = 0 
              OR webNotiStatus = 0)
              AND source = 'registration form'
            GROUP BY 
              userId, fairCode, fiscalYear, CAST(creationTime AS DATE)
          UNION
            SELECT
              id,
              userId,
              fairCode,
              fiscalYear,
              eventId,
              seminarId,
              userRole,
              emailNotiStatus,
              webNotiStatus,
              source,
              creationTime
            FROM 
              vepFairDb.vepFairSeminarRegistration
            WHERE 
              (emailNotiStatus = 0 
              OR webNotiStatus = 0)
              AND source = 'intelligence hub'
        ) seminarRegistration
        LEFT JOIN vepFairDb.fairParticipant participant ON participant.ssoUid = seminarRegistration.userId
        LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id AND registration.fairCode = seminarRegistration.fairCode AND registration.fiscalYear = seminarRegistration.fiscalYear
        WHERE (${whereConditions})
        ORDER BY id ASC
      `;
      // LIMIT ${this.scheduleJobLimitSeminarRegistration}
      // LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id

      // console.log(queryForTagetUsers);
      this.logger.log(JSON.stringify({ action: 'targetUsers', section: 'handleSeminarRegistrationReminder', step: 'query', detail: `${queryForTagetUsers}` }));
      const targetUsers = await getConnection('buyerDatabaseForWrite').query(queryForTagetUsers);
      return Promise.all([targetUsers, userWithSeminarsArray]);
    })
    .then(([targetUsers, userWithSeminarsArray]: any[] | any) => {
      if (targetUsers.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target user info 2', section: 'seminarRegistrationReminder', step: 'error', detail: `get target user info 2 fails. error response: ${JSON.stringify(targetUsers)}, error response: ${targetUsers}` }));
        return Promise.reject({
          status: 400,
          message: `get target user info 2 fails. error response: ${JSON.stringify(targetUsers)}`
        });
      }

      this.logger.log(JSON.stringify({ action: 'targetUsers', section: 'seminarRegistrationReminder', step: '6', detail: `targetUsers: ${JSON.stringify(targetUsers)}` }));
      return Promise.all([targetUsers, userWithSeminarsArray, this.notificationAPIService.getMessageBodyForSns({ templateId: NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS, templateSource: templateSource.DIRECT })]);
    })
    .then(async ([targetUsers, userWithSeminarsArray]) => {
      // console.log(targetUsers);
      const pendingToUpdatePromise: Promise<any>[] = [];
      targetUsers.forEach((user: any) => {
        if (user.source === 'intelligence hub') {
          let seminarsDataByTargetUser: any[] = [];
          userWithSeminarsArray.forEach((seminarData: any) => {
            if (user.id === seminarData.id) {
              seminarsDataByTargetUser.push(seminarData);
            }
          });
          this.logger.log(JSON.stringify({ action: 'start hand noti', section: 'handleSeminarRegistrationReminder', step: '7', detail: `source: 'intelligence hub', userData: ${user}, userWithSeminarData: ${JSON.stringify(seminarsDataByTargetUser)}` }));

          pendingToUpdatePromise.push(this.handleNotificationForSeminar({
            templateId: NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS,
            notificationType: NotificationType.SEMINAR_REGISTRATION_SUCCESS,
            userData: user,
            userWithSeminarData: seminarsDataByTargetUser,
            messageBodyTemplate,
          }));
        } else if (user.source === 'registration form') {
          let seminarsDataByTargetUser: any[] = [];
          userWithSeminarsArray.forEach((seminarData: any) => {
            let userDataYear = user.creationTime.getFullYear();
            let userDataMonth = user.creationTime.getMonth();
            let userDataDay = user.creationTime.getDate();

            let userSeminarDataYear = seminarData.creationTime.getFullYear();
            let userSeminarDataMonth = seminarData.creationTime.getMonth();
            let userSeminarDataDay = seminarData.creationTime.getDate();
            if (user.userId === seminarData.userId && user.fairCode === seminarData.fairCode && user.fairYear === seminarData.fairYear && user.source === seminarData.source && userDataYear === userSeminarDataYear && userDataMonth === userSeminarDataMonth && userDataDay === userSeminarDataDay) {
              seminarsDataByTargetUser.push(seminarData);
            }
          });
          this.logger.log(JSON.stringify({ action: 'start hand noti', section: 'seminarRegistrationReminder', step: '7', detail: `source: 'intelligence hub', userData: ${user}, userWithSeminarData: ${seminarsDataByTargetUser}` }));
          pendingToUpdatePromise.push(this.handleNotificationForSeminar({
            templateId: NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS,
            notificationType: NotificationType.SEMINAR_REGISTRATION_SUCCESS,
            userData: user,
            userWithSeminarData: seminarsDataByTargetUser,
            messageBodyTemplate,
          }));
        } else {
          this.logger.log(JSON.stringify({ action: 'distingish short form or long form seminar registration', section: 'handleSeminarSummaryReminder', step: '5', detail: `no handling when source: ${user.source}` }));
        }
      });

      return Promise.allSettled(pendingToUpdatePromise);
    })
    .then(async (pendingToUpdatePromise: any[] | any) => {
      // 8. update the emailStatus and webNotiStatus in vepSeminarRegistration table
      const successIds: any[] = [];
      const failIds: any[]  = [];
      this.logger.log(JSON.stringify({ action: 'pendingToUpdatePromise', section: 'seminarRegistrationReminder', step: '8', detail: `pendingToUpdatePromise: ${JSON.stringify(pendingToUpdatePromise)}` }));
      pendingToUpdatePromise?.forEach((data: any) => {
        data?.value.forEach((dataValue: any) => {
          if (data.status === 'fulfilled' && dataValue.status === 200) {
            successIds.push({
              tableId: dataValue?.tableId,
              channelType: dataValue?.channelType
            });
          } else if (data.status === 'fulfilled' && dataValue?.status !== 200) {
            this.logger.log(JSON.stringify({ action: 'push fail return value to failIds array', section: 'handleSeminarSummaryReminder', step: 'error', detail: 'return tableId fail' }));
            failIds.push({
              // tableId: dataValue?.tableId[0] ?? 0,
              // channelType: dataValue?.channelType ?? 'ERROR',
              message: dataValue.message
            });
          } else if (data.status === 'rejected') {
            this.logger.log(JSON.stringify({ action: 'push fail return value to failIds array', section: 'handleSeminarSummaryReminder', step: 'error', detail: 'return tableId fail' }));
            failIds.push({
              // tableId: dataValue?.tableId[0] ?? 0,
              // channelType: dataValue?.channelType ?? 'ERROR',
              message: data.reason
            });
          }
        });
      });

      if (failIds.length > 0) {
        this.logger.log(JSON.stringify({ action: 'pendingToUpdatePromise', section: `Notification - handleNotificationForSeminarSummary_${NotificationType.SEMINAR_REGISTRATION_SUCCESS}`, step: 'error', detail: `Get failed ID array ${failIds}` }));
        return Promise.reject ({
          status: 401,
          message: `Get failed ID array ${JSON.stringify(failIds)}`
        });
      }

      console.log(successIds);
      this.logger.log(JSON.stringify({ action: 'successIds', section: 'seminarRegistrationReminder', step: '9', detail: `successIds: ${successIds}` }));
      let updateEmailArray: any[] = [];
      let updateWebNotiArray: any[] = [];
      successIds?.forEach((dataArray: any) => {
        if (dataArray.channelType.includes(ChannelType.WEB_NOTIFICATION)) {
          dataArray.tableId.forEach((tableId: any) => {
            updateWebNotiArray.push({
              id: tableId,
              webNotiStatus: EmailStatus.SENT,
              lastUpdatedTime: new Date()
            });
          })
        }
        if (dataArray.channelType.includes(ChannelType.EMAIL)) {
          dataArray.tableId.forEach((tableId: any) => {
            updateEmailArray.push({
              id: tableId,
              emailNotiStatus: EmailStatus.SENT,
              lastUpdatedTime: new Date()
            });
          })
        }
      });

      let resultArray: any[] = [];
      if (updateEmailArray.length !== 0) {
        resultArray.push(this.notificationService.updateSeminarEmailNotificationStatus({ updateArray: updateEmailArray }));
      }
      if (updateWebNotiArray.length !== 0) {
        resultArray.push(this.notificationService.updateSeminarWebNotificationStatus({ updateArray: updateWebNotiArray }));
      }
      return Promise.all(resultArray);
    })
    .catch(async (error: any) => {
      this.logger.log(JSON.stringify({ action: 'catch error', section: 'seminarRegistrationReminder', step: 'error', detail: `error message: ${JSON.stringify(error)}` }));
      // status: error?.status ?? 400,
      // message: error?.message ?? JSON.stringify(error)
      // insert to noti DB for error case, so that it wont find when left JOIN noti table

      let promiseArrayResult: any;
      if (error.status === 400) {
        const promiseArray = this.notificationService.createNotificationErrorRecordCenter({
          refUserId: userId,
          refFairCode: fairCode,
          refFiscalYear: fiscalYear,
          templateId: NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS,
          notificationType:NotificationType.SEMINAR_REGISTRATION_SUCCESS,
          error,
          messageBodyTemplate: messageBodyTemplate.data,
          userDetailData: userDetailDataForCreatingRecord
        })

        promiseArrayResult = await Promise.all(promiseArray);
      }
        return {
          status: 400,
          message: `ERROR: ${error}`,
          data: {
            promiseArrayResult
          }
        };
    })
    .finally(() => {
      slaveRunner.release();
    })
  }

  public async handleNotificationForSeminar({ templateId, notificationType, userData, userWithSeminarData, messageBodyTemplate }: handleNotificationForSeminar) {
    try {
      // 1. Prepare the target user detail
      const userId = userData?.userId;
      const fairCode = userData?.fairCode;
      const fiscalYear = userData?.fiscalYear;
      const userRole = userData?.userRole;
      const userEmailAddress = userData?.userEmail;
      const firstName = userData?.firstName;
      const lastName = userData?.lastName;

      let isBuyer: boolean;
      if (userRole === 'Buyer') {
        isBuyer = true;
      } else {
        isBuyer = false;
      }

      // 2. Throw error, if one of the target user details are null
      if (!userId || !fairCode || !fiscalYear || !userRole || !userEmailAddress || !lastName || !firstName) {
        this.logger.log(JSON.stringify({ action: 'prepare the target user detail', section: `Notification - handleNotificationForSeminarSummary_${notificationType}`, step: 'error', detail: `user data get fail. The userData: ${JSON.stringify(userData)}` }));
        throw `user data get fail. The userData: ${JSON.stringify(userData)}`;
      }

      // 3. Prepare the messageBody and send to SNS
      const handleNotiResult = await this.preparePlaceHoldersAndSendToSns({
        notificationType,
        userData,
        userDetailData: userWithSeminarData,
        templateId,
        fairCode,
        isBuyer,
        firstName,
        lastName,
        notificationGroup: notificationGroup.SEMINARS,
        messageBodyTemplate,
        emailIds: userWithSeminarData[0].userEmail,
        lang: userWithSeminarData[0].preferredLanguage,
      })
      
      return handleNotiResult;

    } catch (error) {
        return {
          status: 400,
          message: `ERROR: ${error}`
        };
    }
  }

  public async prepareSeminarDataByUser({ userData, targetBuyers, userPreferredLanguage, userEmailAddress, successSeminarsEn, successSeminarsTc, successSeminarsSc }: any) {
    const userWithSeminarsArray: any[] = [];
    let seminarsFilteredTempList: any;

    targetBuyers.forEach((user: any) => {
      if (userPreferredLanguage === 'tc') {
        successSeminarsTc.forEach((eventList: any) => {
          seminarsFilteredTempList = eventList?.data?.data.filter((seminar: any) => {
            return user.eventId === seminar.eventId && user.seminarId === seminar.id
          });
          if (seminarsFilteredTempList.length !== 0) {
            userWithSeminarsArray.push({
              userId: userData?.userId,
              userEmail: userEmailAddress,
              firstName: targetBuyers[0]?.firstName,
              lastName: targetBuyers[0]?.lastName,
              preferredLanguage: userPreferredLanguage,
              fairCode: userData?.fairCode,
              fiscalYear: userData?.fiscalYear,
              eventId: user?.eventId,
              seminarId: user?.seminarId,
              seminarStartTime: seminarsFilteredTempList[0]?.startAt,
              seminarType: seminarsFilteredTempList[0]?.type,
              seminarName: seminarsFilteredTempList[0]?.name,
              seminarLocation: seminarsFilteredTempList[0]?.location,
              tableId: targetBuyers?.tableId
            });
          }
        });
      } else if (userPreferredLanguage === 'sc') {
        successSeminarsSc.forEach((eventList: any) => {
          seminarsFilteredTempList = eventList?.data?.data.filter((seminar: any) => {
            return user.eventId === seminar.eventId && user.seminarId === seminar.id
          });
          if (seminarsFilteredTempList.length !== 0) {
            userWithSeminarsArray.push({
              userId: userData?.userId,
              userEmail: userEmailAddress,
              firstName: targetBuyers[0]?.firstName,
              lastName: targetBuyers[0]?.lastName,
              preferredLanguage: userPreferredLanguage,
              fairCode: userData?.fairCode,
              fiscalYear: userData?.fiscalYear,
              eventId: user?.eventId,
              seminarId: user?.seminarId,
              seminarStartTime: seminarsFilteredTempList[0]?.startAt,
              seminarType: seminarsFilteredTempList[0]?.type,
              seminarName: seminarsFilteredTempList[0]?.name,
              seminarLocation: seminarsFilteredTempList[0]?.location,
              tableId: targetBuyers?.tableId
            });
          }
        });
      } else {
        successSeminarsEn.forEach((eventList: any) => {
          seminarsFilteredTempList = eventList?.data?.data.filter((seminar: any) => {
            return user.eventId === seminar.eventId && user.seminarId === seminar.id
          });
          if (seminarsFilteredTempList.length !== 0) {
            userWithSeminarsArray.push({
              userId: userData?.userId,
              userEmail: userEmailAddress,
              firstName: targetBuyers[0]?.firstName,
              lastName: targetBuyers[0]?.lastName,
              preferredLanguage: userPreferredLanguage,
              fairCode: userData?.fairCode,
              fiscalYear: userData?.fiscalYear,
              eventId: user?.eventId,
              seminarId: user?.seminarId,
              seminarStartTime: seminarsFilteredTempList[0]?.startAt,
              seminarType: seminarsFilteredTempList[0]?.type,
              seminarName: seminarsFilteredTempList[0]?.name,
              seminarLocation: seminarsFilteredTempList[0]?.location,
              tableId: targetBuyers?.tableId
            });
          }
        });
      }
    })

    return userWithSeminarsArray;
  }

  public async handleNotificationForSeminarSummary({ templateId, notificationType, userData, successSeminarsEn, successSeminarsTc, successSeminarsSc, whereConditionsForEvent, seminarSummaryStartRange, seminarSummaryEndRange, messageBodyTemplate }: handleNotificationForSeminarSummary) {
    try {
      let query = `
        SELECT 
        seminarSummary.*
        ,buyer.emailId as email
        ,participant.emailId as email2
        ,registration.firstName as firstName
        ,registration.lastName as lastName
        ,buyer.preferredLanguage as preferredLanguage
        FROM 
        (
        SELECT 
          userId,
          fairCode,
          fiscalYear,
          eventId,
          seminarId
        FROM 
          vepFairDb.vepFairSeminarRegistration
        WHERE 
          (${whereConditionsForEvent})
          AND userId = '${userData?.userId}'  
          AND fairCode = '${userData?.fairCode}' 
          AND fiscalYear = '${userData?.fiscalYear}' 
          GROUP BY userId, fairCode, fiscalYear, eventId, seminarId
        ) seminarSummary

        LEFT JOIN vepFairDb.fairParticipant participant ON participant.ssoUid = seminarSummary.userId
        LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id AND registration.fairCode = seminarSummary.fairCode AND registration.fiscalYear = seminarSummary.fiscalYear
        LEFT JOIN vepBuyerDb.vepBuyer buyer ON buyer.ssoUid = seminarSummary.userId
      `
      console.log(query);

      const connection = await getConnection('contentDatabase');
      const slaveRunner = connection.createQueryRunner('slave');
      let targetBuyers: any;
      try {
        targetBuyers = await connection.query(query, undefined, slaveRunner);
      } catch (error) {
        console.log("Error in handleNotificationForSeminarSummary api", error)
      } finally {
        slaveRunner.release();
      }

      const userDetailData = targetBuyers[0];

      // 1. Prepare the target user detail
      const userId = userData?.userId;
      const fairCode = userData?.fairCode;
      const fiscalYear = userData?.fiscalYear;
      const userRole = userData?.userRole;
      const userPreferredLanguage = userDetailData?.preferredLanguage || 'en';
      const userEmailAddress = userDetailData?.email || userDetailData?.email2;
      const firstName = userDetailData?.firstName;
      const lastName = userDetailData?.lastName;
      let isBuyer: boolean;
      if (userRole === 'Buyer') {
        isBuyer = true;
      } else {
        isBuyer = false;
      }

      // 2. Throw error, if one of the target user details are null
      if (!userId || !fairCode || !fiscalYear || !userRole || !userEmailAddress) {
        this.logger.log(JSON.stringify({ action: 'prepare the target user detail', section: `Notification - handleNotificationForSeminarSummary_${notificationType}`, step: 'error', detail: `user data get fail. The userData: ${JSON.stringify(userData)}` }));
        throw `user data get fail. The userData: ${JSON.stringify(userData)}`;
      }

      // 3. Prepare the target user detail with seminar data
      const userWithSeminarsArray: any[] = await this.prepareSeminarDataByUser({ userData, targetBuyers, userPreferredLanguage, userEmailAddress, successSeminarsEn, successSeminarsTc, successSeminarsSc })
      if (userWithSeminarsArray.length === 0) {
        this.logger.log(JSON.stringify({ action: 'prepareSeminarDataByUser', section: `Notification - handleNotificationForSeminarSummary_${notificationType}`, step: 'error', detail: `${userId} Request failed ${templateId} ${fairCode}` }));
        return {
          status: constant.COMMON_CONSTANT.FAIL,
          message: `user (${userId}, ${userPreferredLanguage}) cannot get any seminar data ${templateId} ${fairCode}`
        };
      }

      // 4. Prepare the messageBody and send to SNS
      const handleNotiResult = await this.preparePlaceHoldersAndSendToSns({
        notificationType,
        userData,
        userDetailData: userWithSeminarsArray,
        templateId,
        fairCode,
        isBuyer,
        seminarSummaryStartRange,
        seminarSummaryEndRange,
        firstName,
        lastName,
        notificationGroup: notificationGroup.SEMINARS,
        messageBodyTemplate,
        emailIds: userWithSeminarsArray[0].userEmail,
        lang: userWithSeminarsArray[0].preferredLanguage,
      })
      
      return handleNotiResult;
    } catch (error) {
      this.logger.log(JSON.stringify({
        action: `Notification - handleNotificationForSeminarSummary_${notificationType} catch error`,
        section: `Notification - handleNotificationForSeminarSummary_${notificationType}`,
        step: 'catch error',
        detail: `handleNotificationForSeminarSummary fail. error message: ${error}. (ssoUid: ${userData.ssoUid}, fairCode: ${userData.fairCode}, fairYear: ${userData.fiscalYear})` 
      }));

      const emailResult = await this.notificationService.createNotificationRecordInFairDb({ 
        meetingId: 0, 
        refUserId: userData.userId, 
        refFairCode: userData.fairCode, 
        refFiscalYear: userData.fiscalYear,
        templateId, 
        channelType: ChannelType.EMAIL, 
        notificationType, 
        receiverRole: 'ERROR', 
        notificationContent: `ERROR: ${JSON.stringify(error)}`,
        status: EmailStatus.NO_NEED_TO_SEND,
      })

      const webNotiResult = await this.notificationService.createNotificationRecordInFairDb({
        meetingId: 0, 
        refUserId: userData.userId, 
        refFairCode: userData.fairCode, 
        refFiscalYear: userData.fiscalYear,
        templateId, 
        channelType: ChannelType.WEB_NOTIFICATION, 
        notificationType, 
        receiverRole: 'ERROR', 
        notificationContent: `ERROR: ${JSON.stringify(error)}`,
        status: EmailStatus.NO_NEED_TO_SEND,
      })

      return {
        status: constant.COMMON_CONSTANT.FAIL,
        message: `handleNotificationForSeminarSummary fail. error message: ${error}, emailResult: ${emailResult}, webNotiResult: ${webNotiResult}`,
        data: {
          ssoUid: userData.ssoUid,
          fairCode: userData.fairCode,
          fairYear: userData.fiscalYear
        }
      }
    }
  }

  // ------------------------------------------------ End of SeminarNotification ------------------------------------------------ //
  // ------------------------------------------------ BM List Notification ------------------------------------------------ //

  /*
  /*  Handle below notifications:
  /*  1. NEW_BM_LIST
  /*  2. UPDATED_BM_LIST
  /*  3. NO_RESPONSE_REMINDER
  /*  4. NOT_ENOUGH_INTEREST_REMINDER
  */
  public async handleNotificationForBmList({ templateId, notificationType, receiverRole, userData }: handleNotificationForBmList): Promise<any> {
    // 1. Get user detail data
    const query = `
      Select
        registration.fairCode,
        registration.fiscalYear,
        participant.emailId,
        registration.firstName,
        registration.lastName,
        registration.companyName,
        registration.overseasBranchOffice,
        registration.addressCountryCode as buyerCountryCode, 
        buyerCountryList.english_description as buyerCountryEN,
        buyerCountryList.chinese_description_tc as buyerCountryTC,
        buyerCountryList.chinese_description_sc as buyerCountrySC,
        IFNULL( buyer.preferredLanguage,  'en') as preferredLanguage,
        IFNULL( buyerPreferredChannel.email, '0') as buyerReceiveEmail
      FROM
        vepFairDb.fairRegistration registration
        INNER JOIN vepFairDb.fairParticipant participant ON participant.id = registration.fairParticipantId
        LEFT JOIN vepBuyerDb.vepBuyer buyer ON buyer.ssoUid = participant.ssoUid
        LEFT JOIN vep_content.vep_council_global_country buyerCountryList ON buyerCountryList.code = registration.addressCountryCode
        LEFT JOIN vepBuyerDb.vepPreferredChannel buyerPreferredChannel ON buyerPreferredChannel.id = buyer.preferredChannelId
      WHERE
        registration.fairCode = '${userData.fairCode}'
        AND registration.fiscalYear = '${userData.fairYear}'
        AND participant.ssoUid = '${userData.ssoUid}'
    `;
    console.log(query);
    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    let targetBuyers: any;
    try {
      targetBuyers = await connection.query(query, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in handleNotificationForBmList api", error)
    } finally {
      slaveRunner.release();
    }

    const userDetailData = targetBuyers[0];
    if (!userDetailData) {
      this.logger.log(JSON.stringify({ action: 'getBuyerProfile', section: `Notification - handleNotificationForBmList_${notificationType}`, step: 'error', detail: `Cant get buyer ${userData?.ssoUid} detail. Detail: ${JSON.stringify(userData)}` }));
      return {
        status: constant.COMMON_CONSTANT.FAIL,
        message: `Cant get buyer ${userData?.ssoUid} detail. Detail: ${JSON.stringify(userData)}`
      };
    }
    const userPreferredLanguage = userDetailData?.preferredLanguage;
    const userEmailAddress = userDetailData?.emailId;
    const userId = userData?.ssoUid;
    const fiscalYear = userDetailData?.fiscalYear;
    const fairCode = userDetailData?.fairCode;
    const firstName = userDetailData?.firstName;
    const lastName = userDetailData?.lastName;

    // 2. Get fair data
    return this.fairService.getNamesObj(fairCode)
    .then(async (fairData: any) => {
      if (fairData.length === 0) {
        this.logger.log(JSON.stringify({ action: 'getFairData', section: `Notification - handleNotificationForBmList_${notificationType}`, step: 'error', detail: `Cannot get fairData. The fairData (${fairData}) is empty` }));
        return {
          status: constant.COMMON_CONSTANT.FAIL,
          message: `Cannot get fairData. The fairData (${fairData}) is empty`
        };
      }

      // 3. Call api to get message body template
      return Promise.all([fairData, this.notificationAPIService.getMessageBodyForSns({ templateId, templateSource: templateSource.DIRECT })]);
    })
    .then(async ([fairData, messageBodyTemplate]: any) => {
    if (messageBodyTemplate.status === 400 && !messageBodyTemplate.data) {
      this.logger.log(JSON.stringify({ action: 'getNotificationTemplate', section: `Notification - handleNotificationForBmList_${notificationType}`, step: 'error', detail: `${userId} Request failed with status code 503 ${templateId} ${fairCode}` }));
      return {
        status: messageBodyTemplate.status ?? constant.COMMON_CONSTANT.FAIL,
        message: `${userId} Request failed with status code 503 ${templateId} ${fairCode}`
      };
    }

      // 4. Prepare placeholders for message body
      return Promise.all([messageBodyTemplate, this.notificationService.prepareDynamicContentForBmList(userData, userDetailData, templateId, fairCode, fairData)]);
    })
    .then(async ([messageBodyTemplate, placeholders]: any) => {
      if (placeholders === null || placeholders === undefined) {
        this.logger.log(JSON.stringify({
          action: 'mapDataForSnsMessageBody',
          section: `Notification - ${notificationType}`,
          step: 'error',
          detail: `map value for placeholders. placeholders: ${placeholders}` }));
        return {
          status: constant.COMMON_CONSTANT.FAIL,
          message: `map value for placeholders. placeholders: ${placeholders}`
        };
      }

      // 5. Prepare the message body content for SNS
      const messageBodyContent = await this.mapDataForSnsMessageBody({
        messageBodyTemplate, 
        emailIds: userEmailAddress, 
        placeholders, 
        userId, 
        fairCode, 
        isBuyer: true, 
        lang: userPreferredLanguage, 
        notificationGroup: notificationGroup.FAIR,
        notificationType,
        firstName, 
        lastName,
        overseasBranchOffice: userDetailData.overseasBranchOffice, 
        lastUpdatedBy: userData.lastUpdatedBy,
      })
      console.log(messageBodyContent)
      
      return messageBodyContent;
    })
    .then(async (messageBodyContent: any) => {
      if (messageBodyContent === null || messageBodyContent === undefined) {
        this.logger.log(JSON.stringify({
          action: 'mapDataForSnsMessageBody',
          section: `Notification - ${notificationType}`,
          step: 'error',
          detail: `map value to templates fail. messageBodyContent: ${messageBodyContent}` }));
        return {
          status: constant.COMMON_CONSTANT.FAIL,
          message: `map value to templates fail. messageBodyContent: ${messageBodyContent}`
        };
      }

      // 6. Send to SNS
      const handledNotificationResult: any[] = [];
      handledNotificationResult.push(
        this.notificationService.sendSnsNotificationBmList({
          userDetailData,
          userId,
          fairCode,
          fiscalYear,
          templateId,
          notificationType,
          receiverRole: messageBodyContent.metaData.toRole,
          content: messageBodyContent,
          userData,
        })
      );

      return Promise.all(handledNotificationResult);
    })
    .catch((error) => {
      this.logger.log(JSON.stringify({
        action: `Notification - handleNotificationForBmList_${notificationType} catch error`,
        section: `Notification - handleNotificationForBmList_${notificationType}`,
        step: 'catch error',
        detail: `handleNotificationForBmList fail. error message: ${error}. (ssoUid: ${userData.ssoUid}, fairCode: ${userData.fairCode}, fairYear: ${userData.fairYear})` }));
      return {
        status: constant.COMMON_CONSTANT.FAIL,
        message: `handleNotificationForBmList fail. error message: ${error}`,
        data: {
          ssoUid: userData.ssoUid,
          fairCode: userData.fairCode,
          fairYear: userData.fairYear
        }
      }
    });
  }

  // ------------------------------------------------ End of BM List Notification ------------------------------------------------ //

  // ------------------------------------------------ Retry Function for notification ------------------------------------------------ //


  public async handleDataForRetryMeetingNoti(record: any): Promise<any> {
    let retryCount = record.retryCount + 1; 
    let channelType;
    
    switch (record.channelType) {
      case ChannelType.EMAIL:
        channelType = ChannelType.EMAIL;
      break;

      case ChannelType.WEB_NOTIFICATION:
        channelType = ChannelType.WEB_NOTIFICATION;
      break;

      case ChannelType.PUSH:
        channelType = ChannelType.PUSH;
      break;

      default:
        await this.notificationService.updateNotificationErrorStatus({
          meetingId: record.meetingRefId, 
          notificationId: record.notiRefId, 
          notificationContent: 'ERROR: channel type error in the record', 
          status: EmailStatus.CANNOT_SEND_GET_CHANNEL_TYPE_ERROR, 
          retryCount: retryCount
        });
        this.logger.log(JSON.stringify({
          action: `distinguish channelType of the record`,
          section: `Notification - handleDataForRetryMeetingNoti`,
          step: 'error',
          detail: `ERROR: channel type error in the record (${JSON.stringify(record)})`,
        }));
        return {
          status: 400,
          message: `ERROR: channel type error in the record (${JSON.stringify(record)})`,
        };
    }

    let isRequester = false;
    // BM schedule meeting, requester default is buyer 
    if (record.assignerRole === MeetingRole.ADMIN && record.receiverRole == MeetingRole.BUYER ) {
      isRequester = true;

    // assginer = receiver = exhibitor
    } else if (record.assignerRole === MeetingRole.EXHIBITOR && record.receiverRole == MeetingRole.EXHIBITOR ) {
      isRequester = true;
    
    // assginer = receiver = buyer
    } else if (record.assignerRole === MeetingRole.BUYER && record.receiverRole == MeetingRole.BUYER ) {
      isRequester = true;
    }
  
    // simliar meeting and noti record 
    let meetingData = JSON.parse(JSON.stringify(record));
    meetingData.id = record.meetingRefId; 
    meetingData.meetingId = record.meetingRefMeetingId; 
    meetingData.status = record.meetingRefStatus; 
    meetingData.templateId = parseInt(record.templateId); 

    let notificationRecord = JSON.parse(JSON.stringify(record));
    notificationRecord.id = record.notiRefId; 
    notificationRecord.meetingId = record.notiRefMeetingId; 
    notificationRecord.status = record.notiRefStatus; 
    notificationRecord.templateId = parseInt(record.templateId); 
  
    console.log(meetingData);
    console.log(notificationRecord);

    return this.handleNotificationForRetry({
      templateId : notificationRecord.templateId,
      notificationType: record.notificationType,
      meetingData: meetingData,
      fairCode: record.fairCode,
      isRequester: isRequester,
      channelType: channelType,
      notificationRecord: notificationRecord,
      retryCount: retryCount
    })
    .then((result: any) => {
      return Promise.all(result)
    })
    .catch(async (error: any) => {
      const errorResult = await this.notificationService.updateNotificationErrorStatus({
        meetingId: meetingData.id, 
        notificationId: notificationRecord.id, 
        notificationContent: JSON.stringify(error),
        status: EmailStatus.HANDLE_NOTI_ERROR, 
        retryCount: retryCount
      });
      this.logger.log(JSON.stringify({
        action: `handleDataForRetryMeetingNoti catch error`,
        section: `Notification - handleDataForRetryMeetingNoti`,
        step: 'catch error',
        detail: `handleDataForRetryMeetingNoti fail. error message: ${JSON.stringify(error)}, errorResult: ${errorResult}`,
      }));
      return {
        status:  error?.status ?? 400,
        message: `handleDataForRetryMeetingNoti fail. error message: ${JSON.stringify(error)}, errorResult: ${errorResult}`,
      }
    });
  }

  /*
  /*  Handle below notifications:
  /*  1. CREATE_MEETING
  /*  2. RESCHEDULE_MEETING
  /*  3. ACCEPT_MEETING
  /*  4. REJECT_MEETING
  /*  5. CANCEL_MEETING
  /*  6. AUTO_CANCEL_MEETING
  /*  7. BM_CREATE_MEETING
  /*  8. BM_CREATE_MEETING_NO_PENDING_MEETING
  /*  9. BM_CREATE_MEETING_WITH_PENDING_MEETING
  /*  10. RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR
  /*  11. CANCEL_BM_MEETING_BY_BUYER_OR_EXHIBITOR
  /*  12. CANCEL_BM_MEETING_BY_BM
  /*  13. CANCEL_C2M_MEETING_BY_BM
  */
  public handleNotificationForRetry({ templateId, notificationType, meetingData, fairCode, isRequester, channelType, notificationRecord, retryCount }: handleNotificationForRetry): Promise<any> {
    let receiverData = {
      receiverRole: '',
      receiverSsouid: '',
      receiverFairCode: '',
      receiverFairYear: '',
      receiverFirstName: '',
      receiverLastName: '',
    }
    if (isRequester) {
      receiverData.receiverRole = meetingData.requesterRole;
      receiverData.receiverSsouid = meetingData.requesterSsoUid;
      receiverData.receiverFairCode = meetingData.fairCode;
      receiverData.receiverFairYear = meetingData.fiscalYear;
      receiverData.receiverFirstName = meetingData.requesterFirstName;
      receiverData.receiverLastName = meetingData.requesterLastName;
    } else {
      receiverData.receiverRole = meetingData.responderRole;
      receiverData.receiverSsouid = meetingData.responderSsoUid;
      receiverData.receiverFairCode = meetingData.responderFairCode;
      receiverData.receiverFairYear = meetingData.responderFiscalYear;
      receiverData.receiverFirstName = meetingData.responderFirstName;
      receiverData.receiverLastName = meetingData.responderLastName;
    }

    return this.fairService.getNamesObj(receiverData.receiverFairCode)
    .then(async (fairResult) => {
      if (!fairResult || fairResult.status === 400) {
        await this.notificationService.updateNotificationErrorStatus({
          meetingId: meetingData.id,
          notificationId: notificationRecord.id,
          notificationContent: `ERROR get fair info fail - API response: ${fairResult.message}`,
          status: EmailStatus.CANNOT_SEND_GET_FAIRINFO_ERROR,
          retryCount
        });
        this.logger.log(JSON.stringify({ action: 'handleNotificationForRetry', section: 'Notification - getNamesObj', step: 'error', detail: `get fair info fail - Input: ${meetingData.fairCode} ; API response: ${fairResult.message}` }));
        return Promise.reject({
          status: 400,
          message: `get fair info fail - Input: ${meetingData.fairCode} ; API response: ${fairResult.message}`,
        })
      }

      return Promise.all([
        this.getUserInfo({ fairCode, meetingData, isRequester }),
        this.getUserInfo({ fairCode, meetingData, isRequester: !isRequester }),
        fairResult
      ]);
    })
    .then(async ([profileResult, counterProfile, fairResult]) => {
      if (profileResult.status === 400 || !profileResult.userProfile) {
        await this.notificationService.updateNotificationErrorStatus({
          meetingId: meetingData.id,
          notificationId: notificationRecord.id,
          notificationContent: `Cant get self profile in ${JSON.stringify(meetingData)}`,
          status: EmailStatus.CANNOT_SEND_GET_PROFILE_ERROR,
          retryCount
        });
        this.logger.log(JSON.stringify({ action: 'handleNotificationForRetry', section: 'Notification - getSelfProfile', step: 'error', detail: 'Cant get self profile' }));
        return Promise.reject({
          status: 400,
          message: `Cant get self profile in ${JSON.stringify(meetingData)}`,
        })
      }

      if (counterProfile.status === 400) {
        await this.notificationService.updateNotificationErrorStatus({
          meetingId: meetingData.id,
          notificationId: notificationRecord.id,
          notificationContent: `Cant get counter profile in ${JSON.stringify(meetingData)}`,
          status: EmailStatus.CANNOT_SEND_GET_COUNTER_PROFILE_ERROR,
          retryCount
        });
        this.logger.log(JSON.stringify({ action: 'handleNotificationForRetry', section: 'Notification - getCounterProfile', step: 'error', detail: 'Cant get counter profile' }));
        return Promise.reject({
          status: 400,
          message: `Cant get counter profile in ${JSON.stringify(meetingData)}`,
        })
      }

      const userProfile = remapUserProfile(profileResult.userProfile);
      const newCounterProfile = remapCounterUserProfile(profileResult.userProfile, counterProfile.userProfile);

      if (meetingData.responderRole !== ReceiverRole.BUYER && meetingData.responderRole !== ReceiverRole.EXHIBITOR) {
        await this.notificationService.updateNotificationErrorStatus({
          meetingId: meetingData.id,
          notificationId: notificationRecord.id,
          notificationContent: `ERROR responderRole in meetingData is incorrect. meetingData.responderRole: ${meetingData.responderRole}`,
          status: EmailStatus.CANNOT_SEND_GET_PROFILE_ERROR,
          retryCount
        });
        this.logger.log(JSON.stringify({ action: 'handleNotificationForRetry', section: 'Notification - after remapUserProfile', step: 'error', detail: `responderRole in meetingData is incorrect. meetingData.responderRole: ${meetingData.responderRole}` }));
        return Promise.reject({
          status: 400,
          message: `responderRole in meetingData is incorrect. meetingData.responderRole: ${meetingData.responderRole}`,
        })
      }
  
      if (!meetingData.requesterSsoUid) {
        await this.notificationService.updateNotificationErrorStatus({
          meetingId: meetingData.id,
          notificationId: notificationRecord.id,
          notificationContent: `ERROR requesterSsoUid in meetingData is incorrect. meetingData.responderRole: ${meetingData.requesterSsoUid}`,
          status: EmailStatus.CANNOT_SEND_GET_PROFILE_ERROR,
          retryCount
        });
        this.logger.log(JSON.stringify({ action: 'handleNotificationForRetry', section: 'Notification - after remapUserProfile', step: 'error', detail: `requesterSsoUid in meetingData is incorrect. meetingData.requesterSsoUid: ${meetingData.requesterSsoUid}` }));
        return Promise.reject({
          status: 400,
          message: `requesterSsoUid in meetingData is incorrect. meetingData.requesterSsoUid: ${meetingData.requesterSsoUid}`,
        })
      }
  
      if (!userProfile.userId) {
        await this.notificationService.updateNotificationErrorStatus({
          meetingId: meetingData.id,
          notificationId: notificationRecord.id,
          notificationContent: `ERROR userId in userProfile is incorrect. userProfile.userId: ${userProfile.userId}`,
          status: EmailStatus.CANNOT_SEND_GET_PROFILE_ERROR,
          retryCount
        });
        this.logger.log(JSON.stringify({ action: 'handleNotificationForRetry', section: 'Notification - after remapUserProfile', step: 'error', detail: `userId in userProfile is incorrect. userProfile.userId: ${userProfile.userId}` }));
        return Promise.reject({
          status: 400,
          message: `userId in userProfile is incorrect. userProfile.userId: ${userProfile.userId}`,
        })
      }

      const preparedContent = this.notificationService.prepareDynamicContent(
        meetingData,
        userProfile,
        templateId,
        fairResult,
        userProfile.userTimezone,
        newCounterProfile,
        receiverData.receiverFairCode,
      );

      return Promise.all([userProfile, this.notificationAPIService.getMessageBodyForSns({ templateId, templateSource: templateSource.DIRECT }), preparedContent]);
    })
    .then(async ([userProfile, messageBodyTemplate, preparedContent]) => {
      if (messageBodyTemplate.status === 400 && !messageBodyTemplate.data) {
        await this.notificationService.updateNotificationErrorStatus({
          meetingId: meetingData.id,
          notificationId: notificationRecord.id,
          notificationContent: `Cant get noti template. Input: ${templateId}, ${fairCode} ; Output ${JSON.stringify(messageBodyTemplate)}`,
          status: EmailStatus.CANNOT_SEND_GET_TEMPLATE_ERROR,
          retryCount
        });

        this.logger.log(JSON.stringify({ action: 'handleNotificationForRetry', section: `Notification - getMessageBodyForSns`, step: 'error', detail: `Request failed ${templateId} ${fairCode}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}` }));
        return Promise.reject(`Request failed ${templateId} ${fairCode}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}`);
      }

      const messageBodyContent: any =  this.mapDataForSnsMessageBodyForMeeting({
        messageBodyTemplate,
        meetingData,
        emailIds: userProfile.emailId, 
        placeholders: preparedContent, 
        userId: receiverData.receiverSsouid, 
        fairCode: receiverData.receiverFairCode, 
        isBuyer: receiverData.receiverRole === 'BUYER' ? true : false, 
        lang: userProfile.preferredLanguage, 
        firstName: receiverData.receiverFirstName, 
        lastName: receiverData.receiverLastName,
        overseasBranchOffice: userProfile.overseasBranchOffice,
      })

      return Promise.all([messageBodyContent]);
    })
    .then(([messageBodyContent]) => {
      const handledNotificationResult: any[] = [];
      handledNotificationResult.push(
        this.notificationService.sendSnsNotificationMeeting({
          meetingData, 
          recordCreation: [notificationRecord],
          notificationType, 
          receiverRole: receiverData.receiverRole, 
          content: messageBodyContent, 
          retryCount
        })
      )

      return Promise.all(handledNotificationResult);
    })
    .catch(async (error) => {
      await this.notificationService.updateNotificationStatus({meetingId: meetingData.id, notificationId: notificationRecord.id, status: EmailStatus.HANDLE_NOTI_ERROR, retryCount});

      this.logger.log(JSON.stringify({
        action: `handleNotificationRetry catch error`,
        section: `Notification - handleNotificationRetry`,
        step: 'catch error',
        detail: error?.message ?? JSON.stringify(error),
      }));
      return {
        status: error?.status ?? 400,
        message: error?.message ?? JSON.stringify(error),
      }
    });
  }

  public async prepareDataForRetrySendingSeminarNoti(record: any, allRetrySendingSeminarNoti: any): Promise<any> {
    let retryCount = record.retryCount + 1;
    let channelType;

    switch (record.channelType) {
      case ChannelType.EMAIL:
        channelType = ChannelType.EMAIL;
      break;
      case ChannelType.WEB_NOTIFICATION:
        channelType = ChannelType.WEB_NOTIFICATION;
      break;
      default:
        await this.notificationService.updateNotificationStatus({ meetingId: record.meetingRefId, notificationId: record.notiRefId, status: 9, retryCount });
      return;
    }
    console.log(channelType);

    let seminarId: any[] = [];
    let notiTableId: any[] = [];
    let seminarTableId: any[] = [];
    if (record.source == 'registration form') {
      allRetrySendingSeminarNoti.forEach((allSeminars: any) => {
        if (allSeminars.refUserId === record.refUserId && allSeminars.refFairCode === record.refFairCode && allSeminars.refFiscalYear === record.refFiscalYear && allSeminars.channelType === record.channelType && allSeminars.creationTime.getFullYear() === record.creationTime.getFullYear() && allSeminars.creationTime.getMonth() === record.creationTime.getMonth() && allSeminars.creationTime.getDate() === record.creationTime.getDate()) {
          seminarId.push(allSeminars.seminarId);
          notiTableId.push(allSeminars.notiRefId);
          seminarTableId.push(allSeminars.notiRefSeminarId);
        }
      })
    } else if (record.source == 'admin portal import') {
      allRetrySendingSeminarNoti.forEach((allSeminars: any) => {
        if (allSeminars.refUserId === record.refUserId 
          && allSeminars.refFairCode === record.refFairCode 
          && allSeminars.refFiscalYear === record.refFiscalYear 
          && allSeminars.channelType === record.channelType 
          && allSeminars.creationTime.getFullYear() === record.creationTime.getFullYear() 
          && allSeminars.creationTime.getMonth() === record.creationTime.getMonth() 
          && allSeminars.creationTime.getDate() === record.creationTime.getDate()
          && allSeminars.creationTime.getHours() === record.creationTime.getHours() 
          && allSeminars.creationTime.getMinutes() === record.creationTime.getMinutes() 
          && allSeminars.creationTime.getSeconds() === record.creationTime.getSeconds()) {
          seminarId.push(allSeminars.seminarId)
          notiTableId.push(allSeminars.notiRefId)
          seminarTableId.push(allSeminars.notiRefSeminarId)
        }
      })
    } else if (record.source == 'intelligence hub') {
      seminarId.push(record.seminarId);
      notiTableId.push(record.notiRefId);
      seminarTableId.push(record.notiRefSeminarId);
    }

    console.log(seminarId);

    const resultArray: Promise<any>[] = [];
    resultArray.push(this.handleSeminarRegistrationReminderRetry(record.userId, record.fairCode, record.fiscalYear, record.eventId, seminarId, channelType, notiTableId, seminarTableId, retryCount));
    return Promise.all(resultArray);
  }

  public async prepareDataForRetrySendingSeminarSummaryNoti(record: any, allRetrySendingSeminarNoti: any): Promise<any> {
    let retryCount = record.retryCount + 1;
    let channelType;

    switch (record.channelType) {
      case ChannelType.EMAIL:
        channelType = ChannelType.EMAIL;
      break;
      case ChannelType.WEB_NOTIFICATION:
        channelType = ChannelType.WEB_NOTIFICATION;
      break;
      default:
        await this.notificationService.updateNotificationStatus({ meetingId: record.meetingRefId, notificationId: record.notiRefId, status: 9, retryCount });
      return;
    }
    console.log(channelType);

    let seminarId: any[] = [];
    let notiTableId: any[] = [];

    allRetrySendingSeminarNoti.forEach((allSeminars: any) => {
      if (allSeminars.refUserId === record.refUserId && allSeminars.refFairCode === record.refFairCode && allSeminars.refFiscalYear === record.refFiscalYear && allSeminars.notificationContent === record.notificationContent) {
        // in this situation, allSeminars.meetingId is seminarId (since seminarId is saved in 'meetingId' column of vepC2MNotification table)
        seminarId.push(allSeminars.meetingId);
        notiTableId.push(allSeminars.notiRefId);
      }
    });

    const seminarSummaryStartRangeTemp = record?.notificationType;
    const seminarSummaryStartRange = moment(seminarSummaryStartRangeTemp.split(',')[1].trim());
    const seminarSummaryEndRange = moment(seminarSummaryStartRangeTemp.split(',')[2].trim());

    let notificationRecord = JSON.parse(JSON.stringify(record));
    notificationRecord.templateId = parseInt(record.templateId);

    const resultArray: Promise<any>[] = [];
    resultArray.push(this.handleSeminarSummaryReminderRetry(
      record.userId,
      record.fairCode,
      record.fiscalYear,
      record.eventId,
      seminarId,
      notificationRecord.templateId,
      record.notificationType,
      channelType,
      record,
      seminarSummaryStartRange,
      seminarSummaryEndRange,
      notiTableId,
      retryCount
));
    return Promise.all(resultArray);
  }

  public async handleSeminarSummaryReminderRetry(
    userId: string,
    fairCode: string,
    fiscalYear: string,
    eventId: string,
    seminarId: any[],
    templateId: any,
    notificationType: any,
    channelType: any,
    userData: any,
    seminarSummaryStartRange: any,
    seminarSummaryEndRange: any,
    notiTableId: any,
    retryCount: any
): Promise<any> {
    // 1. Get the corresponding 'vms_project_no' and 'vms_project_year' for the target fairs
    let queryForVmsInfo = `
      SELECT
        filterList.faircode,
        filterList.fiscal_year,
        MIN(filterList.vms_project_no) AS vms_project_no,
        MIN(filterList.vms_project_year) AS vms_project_year
      FROM
      (
        SELECT
          faircode,
          fiscal_year,
          IF (fair_setting.meta_key = 'vms_project_no', meta_value, null )  AS vms_project_no,
          IF (fair_setting.meta_key = 'vms_project_year', meta_value, null )  AS vms_project_year
        FROM vep_content.vep_fair_setting fair_setting
          WHERE (meta_key = 'vms_project_no' OR meta_key = 'vms_project_year')
          AND fairCode = '${fairCode}'
          AND fiscal_year = ${fiscalYear}
      ) filterList
      group by faircode, fiscal_year
    `;

    console.log(queryForVmsInfo);

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');

    return connection.query(queryForVmsInfo, undefined, slaveRunner)
    .then(async (targetVmsInfo: any) => {
      if (targetVmsInfo.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get vms info', section: 'handleSeminarSummaryReminderRetry', step: 'error', detail: 'no vms info got' }));
        return Promise.reject({
          status: 400,
          message: 'no vms info got'
        });
      }

      // 2. Get the target users list with user detail (conditions: userId, fairCode, fiscalYear, emailNotiStatus = 0 OR webNotiStatus = 0)
      // * include retry mechanism
      let whereConditionsSeminarId = '';
      for (let i = 0; i < seminarId.length; i++) {
        if (i === 0) {
          whereConditionsSeminarId += ` seminarRegistration.seminarId = '${seminarId[i]}' `;
        } else {
          whereConditionsSeminarId += ` OR seminarRegistration.seminarId = '${seminarId[i]}' `;
        }
      }

      let queryForTagetUserWithDetails = `
        SELECT
          seminarRegistration.id,
          seminarRegistration.userId,
          seminarRegistration.fairCode,
          seminarRegistration.fiscalYear,
          seminarRegistration.eventId,
          seminarRegistration.seminarId,
          seminarRegistration.emailNotiStatus,
          seminarRegistration.webNotiStatus,
          seminarRegistration.source,
          seminarRegistration.creationTime,
          buyer.emailId as userEmail,
          registration.firstName as firstName,
          registration.lastName as lastName,
          buyer.preferredLanguage as preferredLanguage
        FROM
          vepFairDb.vepFairSeminarRegistration seminarRegistration
        LEFT JOIN vepFairDb.fairParticipant participant ON participant.ssoUid = seminarRegistration.userId
        LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id AND registration.fairCode = seminarRegistration.fairCode AND registration.fiscalYear = seminarRegistration.fiscalYear
        LEFT JOIN vepBuyerDb.vepBuyer buyer ON buyer.ssoUid = seminarRegistration.userId
        WHERE (seminarRegistration.userId = '${userId}' AND seminarRegistration.fairCode = '${fairCode}' AND seminarRegistration.fiscalYear = '${fiscalYear}' AND seminarRegistration.eventId = '${eventId}' AND (${whereConditionsSeminarId}))
          ORDER BY id ASC
      `;
      // LIMIT ${this.scheduleJobLimitSeminarRegistration}
      // LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id

      console.log(queryForTagetUserWithDetails);
  
      return Promise.all([targetVmsInfo, connection.query(queryForTagetUserWithDetails, undefined, slaveRunner)]);
    })
    .then(async ([targetVmsInfo, tagetUserWithDetails]: any) => {
      if (tagetUserWithDetails.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target user info', section: 'handleSeminarSummaryReminderRetry', step: 'error', detail: 'get target user info fails' }));
        return Promise.reject({
          status: 400,
          message: 'get target user info fails'
        });
      }

      // 3. Call SBE API
      const allSeminarsPromise: Promise<any>[] = [];
      allSeminarsPromise.push(
        this.fairService
          .findAllSeminars(targetVmsInfo[0].vms_project_no, targetVmsInfo[0].vms_project_year, 'VEP', tagetUserWithDetails[0].preferredLanguage)
          .catch(async (error: any) => {
            this.logger.log(JSON.stringify({
              action: 'call SBE API',
              section: 'handleSeminarSummaryReminderRetry',
              step: 'error',
              detail: {
                vmsProjectNo: targetVmsInfo[0].vms_project_no,
                vmsProjectYear: targetVmsInfo[0].vms_project_year,
                lenguage: tagetUserWithDetails[0].preferredLanguage,
                status: error?.status ?? 400,
                message: error?.message ?? JSON.stringify(error)
              }
            }));
            return Promise.reject({
              status: error?.status ?? 400,
              message: error?.message ?? JSON.stringify(error)
            });
          })
      );

      const allSeminars: any = await Promise.all(allSeminarsPromise);
      console.log(allSeminars);

      return Promise.all([allSeminars, tagetUserWithDetails]);
    })
    .then(async ([allSeminars, tagetUserWithDetails]: any[]) => {
      // 4. filter all status 400 return result from this.fairService.findAllSeminars()
      let successSeminars;
      successSeminars = allSeminars.filter((seminar: any) => seminar.status === 200);
      console.log(successSeminars);

      if (successSeminars.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get success seminar detail', section: 'handleSeminarSummaryReminderRetry', step: 'error', detail: 'no success seminar data got, after calling SBE API' }));
        return Promise.reject({
          status: 400,
          message: 'no success seminar data got, after calling SBE API'
        });
      }

      return Promise.all([successSeminars, tagetUserWithDetails]);
    })
    .then(async ([successSeminars, tagetUserWithDetails]: any[]) => {
      // 5. Loop the targetUsers list and allSeminars to map the data noti need
      const userWithSeminarsArray: any[] = [];
      let seminarsFilteredTempList: any;
      tagetUserWithDetails.forEach((user: any) => {
        successSeminars.forEach((eventList: any) => {
          seminarsFilteredTempList = eventList?.data?.data.filter((seminar: any) => user.eventId === seminar.eventId && user.seminarId === seminar.id);
          if (seminarsFilteredTempList.length !== 0) {
            userWithSeminarsArray.push({
              id: user?.id,
              userId: user?.userId,
              userEmail: user?.userEmail,
              firstName: user?.firstName,
              lastName: user?.lastName,
              preferredLanguage: user?.preferredLanguage,
              fairCode: user?.fairCode,
              fairYear: user?.fiscalYear,
              eventId: user?.eventId,
              seminarId: user?.seminarId,
              seminarStartTime: seminarsFilteredTempList[0]?.startAt,
              seminarType: seminarsFilteredTempList[0]?.type,
              seminarName: seminarsFilteredTempList[0]?.name,
              seminarLocation: seminarsFilteredTempList[0]?.location,
              source: user.source,
              creationTime: user.creationTime
            });
          }
        });
      });

      // console.log(userWithSeminarsArray);
      return Promise.all(userWithSeminarsArray);
    })
    .then(async (userWithSeminarsArray: any) => {
      // 7. Group the target seminarRecordId (same ssoUid, fairCode and fairYear) to 'registration form' or 'intelligence hub' (distingish short form or long form seminar registration)
      if (userWithSeminarsArray.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target users with seminar data', section: 'handleSeminarSummaryReminderRetry', step: 'error', detail: 'cannot get the target users with seminar data after filtering' }));
        return {
          status: 400,
          message: 'cannot get the target users with seminar data after filtering'
        };
      }

      const pendingToUpdatePromise: any[] = [];
      pendingToUpdatePromise.push(this.handleNotificationForSeminarSummaryRetry({
        templateId,
        notificationType,
        userData,
        userWithSeminarData: userWithSeminarsArray,
        seminarSummaryStartRange,
        seminarSummaryEndRange,
        notiTableId,
        channelType,
        retryCount
      }));

      return Promise.all(pendingToUpdatePromise);
    })
    .catch((error: any) => ({
      status: error?.status ?? 400,
      message: error?.message ?? JSON.stringify(error)
    }))
    .finally(() => {
      slaveRunner.release();
    })
  }

  public async handleNotificationForSeminarSummaryRetry({ templateId, notificationType, userData, userWithSeminarData, seminarSummaryStartRange, seminarSummaryEndRange, notiTableId, channelType, retryCount }: handleNotificationForSeminarSummaryRetry) {
    // 1. Prepare the target user detail
    const userId = userData?.userId;
    // to - do: userRole get from seminarRegistration table
    const userRole = 'BUYER';
    // userRole = userData?.userRole;
    const userPreferredLanguage = userWithSeminarData[0]?.preferredLanguage;
    const userEmailAddress = userWithSeminarData[0]?.userEmail;
    const fairCode = userWithSeminarData[0]?.fairCode;
    const fiscalYear = userWithSeminarData[0]?.fairYear;

    if (!userEmailAddress) {
      // throw 'NO EMAIL FOUND IN DATABASE'
      return;
    }

    // get fairData
    const fairData = await this.fairService.getNamesObj(fairCode);
    console.log(fairData);

    // call api to get email template
    const templateContent = await this.notificationAPIService.getTemplateContent({ templateId, fairCode });
    if (templateContent.status === 400 && !templateContent.data) {
      this.logger.log(JSON.stringify({ action: 'getNotificationTemplate', section: 'getNotificationTemplate', step: 'error', detail: `${userId} Request failed with status code 503 ${templateId} ${fairCode}` }));
      // throw (`${userId} Request failed with status code 503 ${templateId} ${fairCode}`);
      return;
    }

    // prepare dynamic words for replacing in the email template
    const preparedDynamicWords = await this.notificationService.prepareDynamicContentForSeminar(userWithSeminarData[0], userWithSeminarData, templateId, fairCode, fairData, seminarSummaryStartRange, seminarSummaryEndRange);

    // email subject
    const emailSubject = templateContent?.data?.content[`emailSubject${userPreferredLanguage[0].toUpperCase()}${userPreferredLanguage[1].toLowerCase()}`];
    const newEmailSubject = await this.notificationService.replaceDynamicValue(templateId, emailSubject, preparedDynamicWords);

    // email content
    const emailContent = templateContent?.data?.content[`emailContent${userPreferredLanguage[0].toUpperCase()}${userPreferredLanguage[1].toLowerCase()}`];
    const newEmailContent = await this.notificationService.replaceDynamicValue(templateId, emailContent, preparedDynamicWords);

    // web noti
    const webNotificationContent = templateContent?.data?.content[`webNotificationContent${userPreferredLanguage[0].toUpperCase()}${userPreferredLanguage[1].toLowerCase()}`];
    const newWebNotificationContent = await this.notificationService.replaceDynamicValue(templateId, webNotificationContent, preparedDynamicWords);

    // send email + web noti
    const resultArray: Promise<any>[] = [];
    if (channelType === ChannelType.EMAIL) {
      resultArray.push(this.notificationService.sendEmailForSeminarSummaryRetry({
        subject: newEmailSubject,
        receiver: userEmailAddress,
        emailContent: newEmailContent,
        sqsQuery: this.configService.get<string>('notification.emailQueueUrlStandard'),
        templateId,
        channelType: ChannelType.EMAIL,
        notificationType,
        receiverRole: userRole,
        userData,
        userId,
        fairCode,
        fiscalYear,
        notiTableId,
        retryCount
      }));
    }

    if (channelType === ChannelType.WEB_NOTIFICATION) {
      resultArray.push(this.notificationService.sendWebNotificationForSeminarSummaryRetry({
        notificationContent: newWebNotificationContent,
        receiver: userEmailAddress,
        userData,
        userId,
        userPreferredLanguage,
        sqsQuery: templateId === NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER ? this.configService.get<string>('notification.webQueueUrlStandard') : this.configService.get<string>('notification.webQueueUrlFast'),
        templateId,
        channelType: ChannelType.WEB_NOTIFICATION,
        notificationType,
        receiverRole: userRole,
        fairCode,
        fiscalYear,
        notiTableId,
        retryCount
      }));
    }

    return Promise.all(resultArray);
  }

  public async handleSeminarRegistrationReminderRetry(userId: string, fairCode: string, fiscalYear: string, eventId: string, seminarId: any[], channelType: any, notiTableId: any, seminarTableId: any, retryCount: any): Promise<any> {
    // 1. Get the corresponding 'vms_project_no' and 'vms_project_year' for the target fairs
    let queryForVmsInfo = `
      SELECT
        filterList.faircode,
        filterList.fiscal_year,
        MIN(filterList.vms_project_no) AS vms_project_no,
        MIN(filterList.vms_project_year) AS vms_project_year
      FROM
      (
        SELECT
          faircode,
          fiscal_year,
          IF (fair_setting.meta_key = 'vms_project_no', meta_value, null )  AS vms_project_no,
          IF (fair_setting.meta_key = 'vms_project_year', meta_value, null )  AS vms_project_year
        FROM vep_content.vep_fair_setting fair_setting
          WHERE (meta_key = 'vms_project_no' OR meta_key = 'vms_project_year')
          AND fairCode = '${fairCode}'
          AND fiscal_year = ${fiscalYear}
      ) filterList
      group by faircode, fiscal_year
    `;

    console.log(queryForVmsInfo);
    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');

    return connection.query(queryForVmsInfo, undefined, slaveRunner)
    .then(async (targetVmsInfo: any) => {
      if (targetVmsInfo.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get vms info', section: 'handleSeminarRegistrationReminderRetry', step: 'error', detail: 'no vms info got' }));
        return Promise.reject({
          status: 400,
          message: 'no vms info got'
        });
      }

      // 2. Get the target users list with user detail (conditions: userId, fairCode, fiscalYear, emailNotiStatus = 0 OR webNotiStatus = 0)
      // * include retry mechanism
      let whereConditionsSeminarId = '';
      for (let i = 0; i < seminarId.length; i++) {
        if (i === 0) {
          whereConditionsSeminarId += ` seminarRegistration.seminarId = '${seminarId[i]}' `;
        } else {
          whereConditionsSeminarId += ` OR seminarRegistration.seminarId = '${seminarId[i]}' `;
        }
      }

      let queryForTagetUserWithDetails = `
        SELECT
          seminarRegistration.id,
          seminarRegistration.userId,
          seminarRegistration.fairCode,
          seminarRegistration.fiscalYear,
          seminarRegistration.eventId,
          seminarRegistration.seminarId,
          seminarRegistration.emailNotiStatus,
          seminarRegistration.webNotiStatus,
          seminarRegistration.source,
          seminarRegistration.creationTime,
          buyer.emailId as userEmail,
          registration.firstName as firstName,
          registration.lastName as lastName,
          buyer.preferredLanguage as preferredLanguage
        FROM
          vepFairDb.vepFairSeminarRegistration seminarRegistration
        LEFT JOIN vepFairDb.fairParticipant participant ON participant.ssoUid = seminarRegistration.userId
        LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id AND registration.fairCode = seminarRegistration.fairCode AND registration.fiscalYear = seminarRegistration.fiscalYear
        LEFT JOIN vepBuyerDb.vepBuyer buyer ON buyer.ssoUid = seminarRegistration.userId
        WHERE 
          (emailNotiStatus = 0 
          OR webNotiStatus = 0)
          AND (seminarRegistration.userId = '${userId}' AND seminarRegistration.fairCode = '${fairCode}' AND seminarRegistration.fiscalYear = '${fiscalYear}' AND seminarRegistration.eventId = '${eventId}' AND (${whereConditionsSeminarId}))
          ORDER BY id ASC
      `;
      // LIMIT ${this.scheduleJobLimitSeminarRegistration}
      // LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id

      console.log(queryForTagetUserWithDetails);

      return Promise.all([targetVmsInfo, connection.query(queryForTagetUserWithDetails, undefined, slaveRunner)]);
    })
    .then(async ([targetVmsInfo, tagetUserWithDetails]: any) => {
      if (tagetUserWithDetails.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target user info', section: 'handleSeminarRegistrationReminderRetry', step: 'error', detail: 'get target user info fails' }));
        return Promise.reject({
          status: 400,
          message: 'get target user info fails'
        });
      }

      // 3. Call SBE API
      const allSeminarsPromise: Promise<any>[] = [];
      allSeminarsPromise.push(
        this.fairService
          .findAllSeminars(targetVmsInfo[0].vms_project_no, targetVmsInfo[0].vms_project_year, 'VEP', tagetUserWithDetails[0].preferredLanguage)
          .catch(async (error: any) => {
            this.logger.log(JSON.stringify({
              action: 'call SBE API',
              section: 'handleSeminarRegistrationReminderRetry',
              step: 'error',
              detail: {
                vmsProjectNo: targetVmsInfo[0].vms_project_no,
                vmsProjectYear: targetVmsInfo[0].vms_project_year,
                lenguage: tagetUserWithDetails[0].preferredLanguage,
                status: error?.status ?? 400,
                message: error?.message ?? JSON.stringify(error)
              }
            }));
            return Promise.reject({
              status: error?.status ?? 400,
              message: error?.message ?? JSON.stringify(error)
            });
          })
      );

      const allSeminars: any = await Promise.all(allSeminarsPromise);
      console.log(allSeminars);

      return Promise.all([allSeminars, tagetUserWithDetails]);
    })
    .then(async ([allSeminars, tagetUserWithDetails]: any[]) => {
      // 4. filter all status 400 return result from this.fairService.findAllSeminars()
      let successSeminars;
      successSeminars = allSeminars.filter((seminar: any) => seminar.status === 200);
      console.log(successSeminars);

      if (successSeminars.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get success seminar detail', section: 'handleSeminarRegistrationReminderRetry', step: 'error', detail: 'no success seminar data got, after calling SBE API' }));
        return Promise.reject({
          status: 400,
          message: 'no success seminar data got, after calling SBE API'
        });
      }

      return Promise.all([successSeminars, tagetUserWithDetails]);
    })
    .then(async ([successSeminars, tagetUserWithDetails]: any[]) => {
      // 5. Loop the targetUsers list and allSeminars to map the data noti need
      const userWithSeminarsArray: any[] = [];
      let seminarsFilteredTempList: any;
      tagetUserWithDetails.forEach((user: any) => {
        successSeminars.forEach((eventList: any) => {
          seminarsFilteredTempList = eventList?.data?.data.filter((seminar: any) => user.eventId === seminar.eventId && user.seminarId === seminar.id);
          if (seminarsFilteredTempList.length !== 0) {
            userWithSeminarsArray.push({
              id: user?.id,
              userId: user?.userId,
              userEmail: user?.userEmail,
              firstName: user?.firstName,
              lastName: user?.lastName,
              preferredLanguage: user?.preferredLanguage,
              fairCode: user?.fairCode,
              fairYear: user?.fairYear,
              eventId: user?.eventId,
              seminarId: user?.seminarId,
              seminarStartTime: seminarsFilteredTempList[0]?.startAt,
              seminarType: seminarsFilteredTempList[0]?.type,
              seminarName: seminarsFilteredTempList[0]?.name,
              seminarLocation: seminarsFilteredTempList[0]?.location,
              source: user.source,
              creationTime: user.creationTime
            });
          }
        });
      });

      // console.log(userWithSeminarsArray);
      return Promise.all(userWithSeminarsArray);
    })
    .then(async (userWithSeminarsArray: any) => {
      // 7. Group the target seminarRecordId (same ssoUid, fairCode and fairYear) to 'registration form' or 'intelligence hub' (distingish short form or long form seminar registration)
      if (userWithSeminarsArray.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target users with seminar data', section: 'handleSeminarSummaryReminder', step: 'error', detail: 'cannot get the target users with seminar data after filtering' }));
        return {
          status: 400,
          message: 'cannot get the target users with seminar data after filtering'
        };
      }

      let whereConditions = '';
      for (let i = 0; i < userWithSeminarsArray.length; i++) {
        console.log(userWithSeminarsArray[i].length);
        if (i === 0) {
          whereConditions += ` seminarRegistration.id = '${userWithSeminarsArray[i].id}' `;
        } else {
          whereConditions += ` OR seminarRegistration.id = '${userWithSeminarsArray[i].id}' `;
        }
      }
      console.log(whereConditions);

      let queryForTagetUsers = `
        SELECT 
          seminarRegistration.*
          ,buyer.emailId as userEmail
          ,registration.firstName as firstName
          ,registration.lastName as lastName
          ,buyer.preferredLanguage as preferredLanguage
        FROM 
        (
            SELECT
              id,
              userId,
              fairCode,
              fiscalYear,
              eventId,
              seminarId,
              emailNotiStatus,
              webNotiStatus,
              source,
              creationTime
            FROM 
              vepFairDb.vepFairSeminarRegistration
            WHERE 
              (emailNotiStatus = 0 
              OR webNotiStatus = 0)
              AND (source = 'registration form' OR source = 'admin portal import')
            GROUP BY 
              userId, fairCode, fiscalYear, DATE_FORMAT(creationTime , "%M %d %Y %H %M %S")
          UNION
            SELECT
              id,
              userId,
              fairCode,
              fiscalYear,
              eventId,
              seminarId,
              emailNotiStatus,
              webNotiStatus,
              source,
              creationTime
            FROM 
              vepFairDb.vepFairSeminarRegistration
            WHERE 
              (emailNotiStatus = 0 
              OR webNotiStatus = 0)
              AND source = 'intelligence hub'
        ) seminarRegistration
        LEFT JOIN vepFairDb.fairParticipant participant ON participant.ssoUid = seminarRegistration.userId
        LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id AND registration.fairCode = seminarRegistration.fairCode AND registration.fiscalYear = seminarRegistration.fiscalYear
        LEFT JOIN vepBuyerDb.vepBuyer buyer ON buyer.ssoUid = seminarRegistration.userId
        WHERE (${whereConditions})
        ORDER BY id ASC
      `;
      // LIMIT ${this.scheduleJobLimitSeminarRegistration}
      // LEFT JOIN vepFairDb.fairRegistration registration ON registration.fairParticipantId = participant.id

      console.log(queryForTagetUsers);

      const targetUsers = await connection.query(queryForTagetUsers, undefined, slaveRunner);
      // console.log(targetUsers);
      const pendingToUpdatePromise: Promise<any>[] = [];
      targetUsers.forEach((user: any) => {
        if (user.source === 'intelligence hub') {
          let seminarsDataByTargetUser: any[] = [];
          userWithSeminarsArray.forEach((seminarData: any) => {
            if (user.id === seminarData.id) {
              seminarsDataByTargetUser.push(seminarData);
            }
          });
          pendingToUpdatePromise.push(this.handleNotificationForSeminarRetry({
            templateId: NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS,
            notificationType: NotificationType.SEMINAR_REGISTRATION_SUCCESS,
            userData: user,
            userWithSeminarData: seminarsDataByTargetUser,
            notiTableId,
            seminarTableId,
            channelType,
            retryCount
          }));
        } else if (user.source === 'registration form') {
          let seminarsDataByTargetUser: any[] = [];
          userWithSeminarsArray.forEach((seminarData: any) => {
            let userDataYear = user.creationTime.getFullYear();
            let userDataMonth = user.creationTime.getMonth();
            let userDataDay = user.creationTime.getDate();

            let userSeminarDataYear = seminarData.creationTime.getFullYear();
            let userSeminarDataMonth = seminarData.creationTime.getMonth();
            let userSeminarDataDay = seminarData.creationTime.getDate();
            if (user.userId === seminarData.userId && user.fairCode === seminarData.fairCode && user.fairYear === seminarData.fairYear && user.source === seminarData.source && userDataYear === userSeminarDataYear && userDataMonth === userSeminarDataMonth && userDataDay === userSeminarDataDay) {
              seminarsDataByTargetUser.push(seminarData);
            }
          });
          pendingToUpdatePromise.push(this.handleNotificationForSeminarRetry({
            templateId: NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS,
            notificationType: NotificationType.SEMINAR_REGISTRATION_SUCCESS,
            userData: user,
            userWithSeminarData: seminarsDataByTargetUser,
            notiTableId,
            seminarTableId,
            channelType,
            retryCount
          }));
        } else if (user.source === 'admin portal import') {
          let seminarsDataByTargetUser: any[] = [];
          userWithSeminarsArray.forEach((seminarData: any) => {
            let userDataYear = user.creationTime.getFullYear();
            let userDataMonth = user.creationTime.getMonth();
            let userDataDay = user.creationTime.getDate();
            let userDataHour = user.creationTime.getHours();
            let userDataMinute = user.creationTime.getMinutes();
            let userDataSecond = user.creationTime.getSeconds();

            let userSeminarDataYear = seminarData.creationTime.getFullYear();
            let userSeminarDataMonth = seminarData.creationTime.getMonth();
            let userSeminarDataDay = seminarData.creationTime.getDate();
            let userSeminarDataHour = seminarData.creationTime.getHours();
            let userSeminarDataMinute = seminarData.creationTime.getMinutes();
            let userSeminarDataSecond = seminarData.creationTime.getSeconds();

            if (user.userId === seminarData.userId 
              && user.fairCode === seminarData.fairCode 
              && user.fairYear === seminarData.fairYear 
              && user.source === seminarData.source 
              && userDataYear === userSeminarDataYear 
              && userDataMonth === userSeminarDataMonth 
              && userDataDay === userSeminarDataDay
              && userDataHour === userSeminarDataHour
              && userDataMinute === userSeminarDataMinute
              && userDataSecond === userSeminarDataSecond) {
              seminarsDataByTargetUser.push(seminarData);
            }
          });
          pendingToUpdatePromise.push(this.handleNotificationForSeminarRetry({
            templateId: NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS,
            notificationType: NotificationType.SEMINAR_REGISTRATION_SUCCESS,
            userData: user,
            userWithSeminarData: seminarsDataByTargetUser,
            notiTableId,
            seminarTableId,
            channelType,
            retryCount
          }));
        } else {
          this.logger.log(JSON.stringify({ action: 'distingish short form or long form seminar registration', section: 'handleSeminarSummaryReminder', step: '5', detail: `no handling when source: ${user.source}` }));
        }
      });

      return Promise.allSettled(pendingToUpdatePromise);
    })
    .then(async (pendingToUpdatePromise: any[] | any) => {
      // 8. update the emailStatus and webNotiStatus in vepSeminarRegistration table
      const successIds: any[] = [];
      const failIds: any[] = [];

      pendingToUpdatePromise?.forEach((data: any) => {
        data?.value.forEach((dataValue: any) => {
          if (data.status === 'fulfilled' && dataValue.status === 200) {
            successIds.push({
              tableId: dataValue.tableId,
              channelType: dataValue.channelType
            });
          } else if (data.status === 'fulfilled' && dataValue?.status !== 200) {
            this.logger.log(JSON.stringify({ action: 'push fail return value to failIds array', section: 'handleSeminarSummaryReminder', step: '6', detail: 'return tableId fail' }));
            failIds.push({
              tableId: dataValue.tableId ?? 0,
              channelType: dataValue.channelType,
              message: dataValue.message
            });
          } else if (data.status === 'rejected') {
            this.logger.log(JSON.stringify({ action: 'push fail return value to failIds array', section: 'handleSeminarSummaryReminder', step: '6', detail: 'return tableId fail' }));
            failIds.push({
              tableId: dataValue.tableId ?? 0,
              channelType: dataValue.channelType,
              message: data.reason
            });
          }
        });
      });

      console.log(successIds);
      let updateEmailArray: any[] = [];
      let updateWebNotiArray: any[] = [];
      successIds?.forEach((dataArray: any) => {
        if (dataArray.channelType === ChannelType.WEB_NOTIFICATION) {
          dataArray.tableId.forEach((tableId: any) => {
            updateWebNotiArray.push({
              id: tableId,
              webNotiStatus: EmailStatus.SENT,
              lastUpdatedTime: new Date()
            });
          });
        } else if (dataArray.channelType === ChannelType.EMAIL) {
          dataArray.tableId.forEach((tableId: any) => {
            updateEmailArray.push({
              id: tableId,
              emailNotiStatus: EmailStatus.SENT,
              lastUpdatedTime: new Date()
            });
          });
        } else {
          this.logger.log(JSON.stringify({ action: 'push tableId to array', section: 'handleSeminarSummaryReminder', step: '7', detail: 'cannot get channel type' }));
        }
      });

      let resultArray: any[] = [];
      if (updateEmailArray.length !== 0) {
        resultArray.push(this.notificationService.updateSeminarEmailNotificationStatus({ updateArray: updateEmailArray }));
      }
      if (updateWebNotiArray.length !== 0) {
        resultArray.push(this.notificationService.updateSeminarWebNotificationStatus({ updateArray: updateWebNotiArray }));
      }
      return Promise.all(resultArray);
    })
    .catch((error: any) => ({
      status: error?.status ?? 400,
      message: error?.message ?? JSON.stringify(error)
    }))
    .finally(() => {
      slaveRunner.release();
    })
  }

  public async handleNotificationForSeminarRetry({ templateId, notificationType, userData, userWithSeminarData, channelType, notiTableId, seminarTableId, retryCount }: handleNotificationForSeminarRetry) {
    try {
      // 1. Prepare the target user detail
      const userId = userData?.userId;
      const fairCode = userData?.fairCode;
      const fiscalYear = userData?.fiscalYear;
      const userRole = 'Buyer';
      // const userRole = userData?.userRole;
      const userEmailAddress = userData?.userEmail;
      const firstName = userData?.firstName;
      const lastName = userData?.lastName;
      // const userPreferredLanguage = userData?.preferredLanguage;


      let isBuyer: boolean;
      if (userRole === 'Buyer') {
        isBuyer = true;
      } else {
        isBuyer = false;
      }

      // 2. Throw error, if one of the target user details are null
      if (!userId || !fairCode || !fiscalYear || !userRole || !userEmailAddress || !lastName || !firstName) {
        this.logger.log(JSON.stringify({ action: 'prepare the target user detail', section: `Notification - handleNotificationForSeminarSummary_${notificationType}`, step: 'error', detail: `user data get fail. The userData: ${JSON.stringify(userData)}` }));
        throw `user data get fail. The userData: ${JSON.stringify(userData)}`;
      }

      // 3. call api to get message body template
      const messageBodyTemplate = await this.notificationAPIService.getMessageBodyForSns({ templateId, templateSource: templateSource.DIRECT });
      if (messageBodyTemplate.status === 400 && !messageBodyTemplate.data) {
        this.logger.log(JSON.stringify({ action: 'getMessageBodyForSns', section: 'getMessageBodyForSns', step: 'error', detail: `${userId} Request failed with status code 503 ${templateId} ${fairCode}` }));
        return await Promise.reject(`${userId} Request failed with status code 503 ${templateId} ${fairCode}`);
      }

      // 4. Prepare the messageBody and send to SNS
      const handleNotiResult = await this.preparePlaceHoldersAndSendToSnsForSemianrRetry({
        notificationType,
        userData,
        userDetailData: userWithSeminarData,
        templateId,
        fairCode,
        isBuyer,
        firstName,
        lastName,
        notificationGroup: notificationGroup.SEMINARS,
        messageBodyTemplate,
        emailIds: userWithSeminarData[0].userEmail,
        lang: userWithSeminarData[0].preferredLanguage,
        notiTableId,
        seminarTableId, 
        retryCount,
        channelType,
      })

      return handleNotiResult;





      // // 1. Prepare the target user detail
      // const userId = userData?.userId;
      // // to - do: userRole get from seminarRegistration table
      // const userRole = 'BUYER';
      // // userRole = userData?.userRole;
      // const userPreferredLanguage = userData?.preferredLanguage;
      // const userEmailAddress = userData?.userEmail;
      // const fairCode = userData?.fairCode;
      // const fiscalYear = userData?.fiscalYear;

      // if (!userEmailAddress) {
      //   throw 'NO EMAIL FOUND IN DATABASE';
      // }

      // // 2. prepare all the seminars detail by the target user (userId + fairCode + fiscalYear)
      // // let seminarsDataByTargetUser: any[] = [];
      // // seminarsDataByTargetUser.push(userWithSeminarData)

      // // console.log(seminarsDataByTargetUser)

      // // get fairData
      // const fairData = await this.fairService.getNamesObj(fairCode);
      // // console.log(fairData)

      // // call api to get message body template
      // const templateContent = await this.notificationAPIService.getMessageBodyForSns({ templateId, templateSource: templateSource.DIRECT });
      // if (templateContent.status === 400 && !templateContent.data) {
      //   this.logger.log(JSON.stringify({ action: 'getMessageBodyForSns', section: 'getMessageBodyForSns', step: 'error', detail: `${userId} Request failed with status code 503 ${templateId} ${fairCode}` }));
      //   return await Promise.reject(`${userId} Request failed with status code 503 ${templateId} ${fairCode}`);
      // }

      // // prepare dynamic words for replacing in the email template
      // const preparedDynamicWords = await this.notificationService.prepareDynamicContentForSeminar(userData, userWithSeminarData, templateId, fairCode, fairData);

      // const pendingToUpdatePromise: any[] = [];

      // // send email + web noti
      // if (channelType === ChannelType.EMAIL) {
      //   pendingToUpdatePromise.push(await this.notificationService.sendEmailForSeminarRetry({
      //     subject: newEmailSubject,
      //     receiver: userEmailAddress,
      //     emailContent: newEmailContent,
      //     sqsQuery: this.configService.get<string>('notification.emailQueueUrlStandard'),
      //     templateId,
      //     channelType: ChannelType.EMAIL,
      //     notificationType,
      //     receiverRole: userRole,
      //     userData,
      //     userId,
      //     fairCode,
      //     fiscalYear,
      //     notiTableId,
      //     seminarTableId,
      //     retryCount
      //   }));
      // }
      // if (channelType === ChannelType.WEB_NOTIFICATION) {
      //   pendingToUpdatePromise.push(await this.notificationService.sendWebNotificationForSeminarRetry({
      //     notificationContent: newWebNotificationContent,
      //     receiver: userEmailAddress,
      //     userData,
      //     userId,
      //     userPreferredLanguage,
      //     sqsQuery: this.configService.get<string>('notification.webQueueUrlStandard'),
      //     templateId,
      //     channelType: ChannelType.WEB_NOTIFICATION,
      //     notificationType,
      //     receiverRole: userRole,
      //     fairCode,
      //     fiscalYear,
      //     notiTableId,
      //     seminarTableId,
      //     retryCount
      //   }));
      // }

      // return pendingToUpdatePromise;
    } catch (error) {
      // insert to noti DB for error case, so that it wont find when left JOIN noti table
      await this.notificationService.createSeminarNotificationRecord(({
        meetingId: 0,
        status: 1,
        receiverRole: 'ERROR',
        refUserId: userData.userId,
        refFairCode: userData.fairCode,
        refFiscalYear: null,
        templateId,
        channelType: ChannelType.EMAIL,
        notificationType,
        notificationContent: `ERROR: ${error}` }));

      await this.notificationService.createSeminarNotificationRecord(({
        meetingId: 0,
        status: 1,
        receiverRole: 'ERROR',
        refUserId: userData.userId,
        refFairCode: userData.fairCode,
        refFiscalYear: null,
        templateId,
        channelType: ChannelType.WEB_NOTIFICATION,
        notificationType,
        notificationContent: `ERROR: ${error}` }));

        return {
          status: 400,
          message: `ERROR: ${error}`
        };
    }
  }



  public async handleNotificationForBmListRetry({ templateId, notificationType, receiverRole, userData, channelType, retryCount }: handleNotificationForBmListRetry): Promise<any> {
    const query = `
      Select
        registration.fairCode,
        registration.fiscalYear,
        participant.emailId,
        registration.firstName,
        registration.lastName,
        registration.companyName,
        registration.overseasBranchOffice,
        registration.addressCountryCode as buyerCountryCode, 
        buyerCountryList.english_description as buyerCountryEN,
        buyerCountryList.chinese_description_tc as buyerCountryTC,
        buyerCountryList.chinese_description_sc as buyerCountrySC,
        IFNULL( buyer.preferredLanguage,  'en') as preferredLanguage,
        IFNULL( buyerPreferredChannel.email, '0') as buyerReceiveEmail
      FROM
        vepFairDb.fairRegistration registration
        INNER JOIN vepFairDb.fairParticipant participant ON participant.id = registration.fairParticipantId
        LEFT JOIN vepBuyerDb.vepBuyer buyer ON buyer.ssoUid = participant.ssoUid
        LEFT JOIN vep_content.vep_council_global_country buyerCountryList ON buyerCountryList.code = registration.addressCountryCode
        LEFT JOIN vepBuyerDb.vepPreferredChannel buyerPreferredChannel ON buyerPreferredChannel.id = buyer.preferredChannelId
      WHERE
        registration.fairCode = '${userData.fairCode}'
        AND registration.fiscalYear = '${userData.fairYear}'
        AND participant.ssoUid = '${userData.ssoUid}'
    `;
    console.log(query);

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    let targetBuyers: any;
    try {
      targetBuyers = await connection.query(query, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in handleNotificationForBmListRetry api", error)
    } finally {
      slaveRunner.release();
    }

    const userDetailData = targetBuyers[0];
    if (!userDetailData) {
      this.logger.log(JSON.stringify({ action: 'getBuyerProfile', section: `Notification - handleNotificationForBmList_${notificationType} - Retry`, step: 'error', detail: `Cant get buyer ${userData?.ssoUid} detail. Detail: ${JSON.stringify(userData)}` }));
      return Promise.reject({
        status: constant.COMMON_CONSTANT.FAIL,
        message: `Cant get buyer ${userData?.ssoUid} detail. Detail: ${userData}`
      });
    }
    const userPreferredLanguage = userDetailData?.preferredLanguage;
    const userEmailAddress = userDetailData?.emailId;
    const userId = userData?.ssoUid;
    const fiscalYear = userDetailData?.fiscalYear;
    const fairCode = userDetailData?.fairCode;

    // get fairData
    return this.fairService.getNamesObj(fairCode)
    .then(async (fairData: any) => {
      if (fairData.length === 0) {
        this.logger.log(JSON.stringify({ action: 'getFairData', section: `Notification - handleNotificationForBmList_${notificationType} - Retry`, step: 'error', detail: `Cannot get fairData. The fairData (${fairData}) is empty` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `Cannot get fairData. The fairData (${fairData}) is empty`
        });
      }

      // call api to get email template
      return Promise.all([fairData, this.notificationAPIService.getTemplateContent({ templateId, fairCode })]);
    })
    .then(async ([fairData, templateContent]: any) => {
    if (templateContent.status === 400 && !templateContent.data) {
      this.logger.log(JSON.stringify({ action: 'getNotificationTemplate', section: `Notification - handleNotificationForBmList_${notificationType} - Retry`, step: 'error', detail: `${userId} Request failed with status code 503 ${templateId} ${fairCode}` }));
      return Promise.reject({
        status: templateContent.status ?? constant.COMMON_CONSTANT.FAIL,
        message: `${userId} Request failed ${templateId} ${fairCode}, getTemplate API response: ${JSON.stringify(templateContent)}`
      });
    }

      // prepare dynamic words for replacing in the email template
      return Promise.all([templateContent, this.notificationService.prepareDynamicContentForBmList(userData, userDetailData, templateId, fairCode, fairData)]);
    })
    .then(async ([templateContent, preparedDynamicWords]: any) => {
      // email subject
      const emailSubject = templateContent?.data?.content[`emailSubject${userPreferredLanguage[0].toUpperCase()}${userPreferredLanguage[1].toLowerCase()}`];
      const newEmailSubject = await this.notificationService.replaceDynamicValue(templateId, emailSubject, preparedDynamicWords);

      // email content
      const emailContent = templateContent?.data?.content[`emailContent${userPreferredLanguage[0].toUpperCase()}${userPreferredLanguage[1].toLowerCase()}`];
      const newEmailContent = await this.notificationService.replaceDynamicValue(templateId, emailContent, preparedDynamicWords);

      // web noti
      const webNotificationContent = templateContent?.data?.content[`webNotificationContent${userPreferredLanguage[0].toUpperCase()}${userPreferredLanguage[1].toLowerCase()}`];
      const newWebNotificationContent = await this.notificationService.replaceDynamicValue(templateId, webNotificationContent, preparedDynamicWords);

      return Promise.all([newEmailSubject, newEmailContent, newWebNotificationContent]);
    })
    .then(async ([newEmailSubject, newEmailContent, newWebNotificationContent]: any) => {
      if (newEmailSubject.length === 0 || newEmailContent.length === 0 || newWebNotificationContent.length === 0) {
        this.logger.log(JSON.stringify({
          action: 'replaceDynamicValue',
          section: `Notification - handleNotificationForBmList_${notificationType} - Retry`,
          step: 'error',
          detail: `replace dynamic value to templates fail. emailSubject: ${newEmailSubject}, emailContent: ${newEmailContent}, webNotificationContent: ${newWebNotificationContent}` 
        }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `replace dynamic value to templates fail. emailSubject: ${newEmailSubject}, emailContent: ${newEmailContent}, webNotificationContent: ${newWebNotificationContent}`
        });
      }

      const handledNotificationResult: any[] = [];
      // send email + web noti
      if (channelType === ChannelType.EMAIL) {
        handledNotificationResult.push(this.notificationService.sendEmailForBmListRetry({
          subject: newEmailSubject,
          receiver: userEmailAddress,
          emailContent: newEmailContent,
          sqsQuery: this.configService.get<string>('notification.emailQueueUrlStandard'),
          templateId,
          channelType: ChannelType.EMAIL,
          notificationType,
          receiverRole,
          userData,
          userDetailData,
          userId,
          fairCode,
          fiscalYear,
          retryCount
        }));
      }
      if (channelType === ChannelType.WEB_NOTIFICATION) {
        handledNotificationResult.push(this.notificationService.sendWebNotificationForBmListRetry({
          notificationContent: newWebNotificationContent,
          receiver: userEmailAddress,
          userData,
          userDetailData,
          userId,
          userPreferredLanguage,
          sqsQuery: this.configService.get<string>('notification.webQueueUrlStandard'),
          templateId,
          channelType: ChannelType.WEB_NOTIFICATION,
          notificationType,
          receiverRole,
          fairCode,
          fiscalYear,
          retryCount
        }));
      }

      return Promise.all(handledNotificationResult);
    })
    .catch((error) => {
      this.logger.log(JSON.stringify({
        action: `Notification - handleNotificationForBmList_${notificationType} catch error`,
        section: `Notification - handleNotificationForBmList_${notificationType} - Retry`,
        step: 'catch error',
        detail: `handleNotificationForBmList fail. error message: ${error}. (ssoUid: ${userData.ssoUid}, fairCode: ${userData.fairCode}, fairYear: ${userData.fairYear})` 
      }));
      return {
        status: constant.COMMON_CONSTANT.FAIL,
        message: `handleNotificationForBmList fail. error message: ${error}`,
        data: {
          ssoUid: userData.ssoUid,
          fairCode: userData.fairCode,
          fairYear: userData.fairYear
        }
      }
    });
  }

  public async handleRetrySendingBMNoti(record: any): Promise<any> {
    let retryCount = record.retryCount + 1;
    let channelType;

    switch (record.channelType) {
        case ChannelType.EMAIL:
          channelType = ChannelType.EMAIL;
        break;
        case ChannelType.WEB_NOTIFICATION:
          channelType = ChannelType.WEB_NOTIFICATION;
        break;
      default:
        await this.notificationService.updateNotificationStatus({ meetingId: record.meetingRefId, notificationId: record.notiRefId, status: EmailStatus.HANDLE_NOTI_ERROR, retryCount });
        return Promise.reject({
          status: 400,
          message: `Cannot find channelType in ${record}`
        });
    }

    let notificationRecord = JSON.parse(JSON.stringify(record));
    notificationRecord.templateId = parseInt(record.templateId);

    return this.handleNotificationForBmListRetry({
      templateId: notificationRecord.templateId,
      notificationType: record.notificationType,
      receiverRole: ReceiverRole.BUYER,
      userData: record,
      channelType,
      retryCount
    })
    .then((result) => {
      return result
    })
    .catch((error) => {
      this.logger.log(JSON.stringify({
        action: `Notification - retrySendingBMNoti catch error`,
        section: `Notification - retrySendingBMNoti`,
        step: 'catch error',
        detail: `step 2 error message: ${error}`
      }));
      return {
        status: constant.COMMON_CONSTANT.FAIL,
        message: `step 2 error message: ${error}`,
      }
    })
  }

  /*
  /*  Handle below notifications:
  /*  1. MEETING_REMINDER
  */
  // public async sendNotiRetry(record: any, targetNotification: NotificationEntity[], templateId: number, notificationType: string) {
  //   // this.notificationService.updateNotificationStatus({meetingId: record.id, notificationId: 999, status: 999, retryCount: 999})
  //   if (record.assignerRole === MeetingRole.EXHIBITOR) {
  //     targetNotification.forEach(notification => {
  //       let retryCount = notification.retryCount;
  //       retryCount = retryCount + 1;
  //       let needRetry = retryCount < 6 && (notification.status === 0 || notification.status === 3 || notification.status === 4 || notification.status === 5 || notification.status === 6 || notification.status === 7 || notification.status === 8|| notification.status === 9)
  //       if (needRetry) {
  //         if (notification.channelType === ChannelType.EMAIL) {
  //           if (notification.receiverRole === ReceiverRole.EXHIBITOR) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: true,
  //               channelType: ChannelType.EMAIL,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //           else if (notification.receiverRole === ReceiverRole.BUYER) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: false,
  //               channelType: ChannelType.EMAIL,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //         }
  //         else if (notification.channelType === ChannelType.WEB_NOTIFICATION) {
  //           if (notification.receiverRole === ReceiverRole.EXHIBITOR) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: true,
  //               channelType: ChannelType.WEB_NOTIFICATION,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //           else if (notification.receiverRole === ReceiverRole.BUYER) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: false,
  //               channelType: ChannelType.WEB_NOTIFICATION,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //         }
  //       }
  //     });
  //   } else if (record.assignerRole === MeetingRole.BUYER) {
  //     targetNotification.forEach(notification => {
  //       let retryCount = notification.retryCount;
  //       retryCount = retryCount + 1;
  //       let needRetry = retryCount < 6 && (notification.status === 0 || notification.status === 3 || notification.status === 4 || notification.status === 5 || notification.status === 6 || notification.status === 7 || notification.status === 8 || notification.status === 9)
  //       if (needRetry) {
  //         if (notification.channelType === ChannelType.EMAIL) {
  //           if (notification.receiverRole === ReceiverRole.EXHIBITOR) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: false,
  //               channelType: ChannelType.EMAIL,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //           else if (notification.receiverRole === ReceiverRole.BUYER) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: true,
  //               channelType: ChannelType.EMAIL,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //         }
  //         else if (notification.channelType === ChannelType.WEB_NOTIFICATION) {
  //           if (notification.receiverRole === ReceiverRole.EXHIBITOR) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: false,
  //               channelType: ChannelType.WEB_NOTIFICATION,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //           else if (notification.receiverRole === ReceiverRole.BUYER) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: true,
  //               channelType: ChannelType.WEB_NOTIFICATION,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //         }
  //       }
  //     });
  //   } else if (record.assignerRole === MeetingRole.ADMIN) {
  //     targetNotification.forEach(notification => {
  //       let retryCount = notification.retryCount;
  //       retryCount = retryCount + 1;
  //       let needRetry = retryCount < 6 && (notification.status === 0 || notification.status === 3 || notification.status === 4 || notification.status === 5 || notification.status === 6 || notification.status === 7 || notification.status === 8 || notification.status === 9)
  //       if (needRetry) {
  //         if (notification.channelType === ChannelType.EMAIL) {
  //           if (notification.receiverRole === ReceiverRole.EXHIBITOR) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: false,
  //               channelType: ChannelType.EMAIL,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //           else if (notification.receiverRole === ReceiverRole.BUYER) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: true,
  //               channelType: ChannelType.EMAIL,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //         }
  //         else if (notification.channelType === ChannelType.WEB_NOTIFICATION) {
  //           if (notification.receiverRole === ReceiverRole.EXHIBITOR) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: false,
  //               channelType: ChannelType.WEB_NOTIFICATION,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //           else if (notification.receiverRole === ReceiverRole.BUYER) {
  //             this.handleNotificationForRetry({
  //               templateId,
  //               notificationType: notificationType,
  //               meetingData: record,
  //               fairCode: record.fairCode,
  //               isRequester: true,
  //               channelType: ChannelType.WEB_NOTIFICATION,
  //               notificationRecord: notification,
  //               retryCount
  //             });
  //           }
  //         }
  //       }
  //     });
  //   }
  // }

  // ------------------------------------------------ End of Retry Function for notification ------------------------------------------------ //

  public async getConfigValueById({ id }: Record<string, any>): Promise<any> {
    this.logger.log(JSON.stringify({ action: 'get', section: 'c2m configuration', step: '1', detail: { id } }));
    return this.c2mConfigEntity.findOne({
      where: {
        id
      }
    })
    .then(result => {
      return {
          status: 200,
          data: result,
          message: `get ID ${id} config in c2mConfig table successfully`
      }
    })
    .catch((error: any) => {
      this.logger.log(JSON.stringify({ action: 'get', section: 'c2m configuration', step: 'error', detail: error }));
      return {
          status: error?.status ?? 400,
          message: error?.message ?? JSON.stringify(error)
      };
    });
  }

  public async getFairRegtrationNoByMeetingId(id: string | number): Promise<any[]> {
    let registrationNoList: any[] = [];

    const connection = await getConnection('c2mDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    let meetingRecords: any[] = [];
    try {
      meetingRecords = await connection.query(`
      SELECT * 
      FROM vep_c2m_service_db.vepC2MMeeting meeting 
      WHERE meeting.id = ${id} 
    `, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in getFairRegtrationNoByMeetingId api", error)
    } finally {
      slaveRunner.release();
    }

    if (Array.isArray(meetingRecords)) {
      let whereCondit = meetingRecords.map(meeting => {
        let { requesterSsoUid, fairCode, fiscalYear, responderSsoUid, responderFairCode, responderFiscalYear } = meeting;
        return `
          (participant.ssoUid = '${requesterSsoUid}' AND registration.fairCode = '${fairCode}' AND registration.fiscalYear = '${fiscalYear}') 
            OR 
          (participant.ssoUid = '${responderSsoUid}' AND registration.fairCode = '${responderFairCode}' AND registration.fiscalYear = '${responderFiscalYear}') 
        `;
      }).join(' OR ');
      if (whereCondit.length > 0) {
        let query = `
        SELECT 
          CONCAT(registration.serialNumber, SUBSTRING(registration.projectYear, 3, 2), registration.sourceTypeCode, registration.visitorTypeCode, registration.projectNumber) AS registrationNo 
        FROM 
          vepFairDb.fairRegistration registration
          INNER JOIN vepFairDb.fairParticipant participant ON participant.id = registration.fairParticipantId 
        WHERE 
          registration.fairRegistrationStatusId = 1 
          AND registration.c2mParticipantStatusId = 1 
          AND (
            ${whereCondit}
          )
        `;
        const connection = await getConnection('c2mDatabase');
        const slaveRunner = connection.createQueryRunner('slave');
        let regNos: any[] = [];
        try {
          regNos = await connection.query(query, undefined, slaveRunner);
        } catch (error) {
          console.log("Error in getFairRegtrationNoByMeetingId api", error)
        } finally {
          slaveRunner.release();
        }

        registrationNoList = regNos?.map((reg: any) => reg.registrationNo);
      }
    }
    return registrationNoList || [];
  }

  public async getVodStatus(seminarId: string) {
    let query = `
    SELECT  rtmp.id as id, seminar.id as seminarId, vod.liveVideoId, vod.playbackVideoId, vod.language, video.transcodeStatus, video.fileName, video.fileUrl
    FROM vepFairDb.vepFairSeminar seminar LEFT JOIN vepFairDb.vepFairSeminarVod vod ON seminar.id = vod.seminarId
    LEFT JOIN vepFairDb.vepFairSeminarVideo video ON vod.liveVideoId = video.id OR vod.playbackVideoId = video.id
    WHERE video.videoStatus = "USING" and seminar.sbeSeminarId = ${seminarId}
    `
      .split('\n')
      .join('')
      .replace(/ +/g, ' ');

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    return connection.query(query, undefined, slaveRunner)
      .then((result) => ({
        status: constant.GENERAL_STATUS.SUCCESS,
        data: result,
      }))
      .catch((error) => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error),
      }))
      .finally(() => {
        slaveRunner.release();
      })
  }

  public async getRtmpStatus(seminarId: string) {
    let query = `
    SELECT  rtmp.id as id, seminar.id as seminarId, rtmp.playbackVideoId, rtmp.language, video.transcodeStatus, video.fileName, video.fileUrl, rtmp.liveUrl, rtmp.key
    FROM vepFairDb.vepFairSeminar seminar LEFT JOIN vepFairDb.vepFairSeminarRtmp rtmp ON seminar.id = rtmp.seminarId
    LEFT JOIN vepFairDb.vepFairSeminarVideo video ON rtmp.playbackVideoId = video.id
    WHERE video.videoStatus = "USING" and seminar.sbeSeminarId = ${seminarId}
    `
      .split('\n')
      .join('')
      .replace(/ +/g, ' ');

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');

    return connection.query(query, undefined, slaveRunner)
      .then((result) => ({
        status: constant.GENERAL_STATUS.SUCCESS,
        data: result,
      }))
      .catch((error) => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error),
      }))
      .finally(() => {
        slaveRunner.release();
      })
  }

  public wait(ms: any): Promise<void> {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
  };

  // public createiCalendarEvent(meetingData: Record<string, any>) {
  //   const { writeFileSync } = require('fs')

  //   const meetings = meetingData.result;
  //   let events: any[] = [];
  //   meetings.forEach((meeting: any) => {
  //     // To Do: using HKT timezone now
  //     let startTimeYear = meeting.startTime.getFullYear();
  //     let startTimeMonth = meeting.startTime.getMonth() + 1;
  //     let startTimeDay = meeting.startTime.getDate();
  //     let startTimeHour = meeting.startTime.getHours();
  //     let startTimeMins = meeting.startTime.getMinutes();
  //     console.log(startTimeYear, startTimeMonth, startTimeDay, startTimeHour, startTimeMins)

  //     let event = {
  //       start: [startTimeYear, startTimeMonth, startTimeDay, startTimeHour, startTimeMins],
  //       duration: { minutes: 30 },
  //       title: meeting.name
  //     }
  //     events.push(event);
  //   })

  //   const { error, value } = createEvents(events)

  //   if (error) {
  //     console.log(error)
  //     return
  //   }

  //   console.log(value)

  //   writeFileSync('/Users/ricky_yu/Desktop/test4.ics', value)
  // }

  // *****Meeting Configuration - Feedback Form - Start*****
  public async getFeedbackFormIdByFair(fairCode: string, fairYear: string) {
    try {
      this.logger.log(JSON.stringify({ action: 'getFeedbackFormIdByFair', step: 'start', detail: {fairCode, fairYear} }));
      const conditions = `( mC.fairCode = "${fairCode}" AND mC.fairYear = "${fairYear}" AND mC.deletionTime IS NULL )`;
      const queryBuilder = this.meetingConfigRepository.createQueryBuilder('mC').where(conditions);

      const result = await queryBuilder.getOne();
      const id = result?.id;
      const feedbackFormId = result?.feedbackFormId;

      this.logger.log(JSON.stringify({ action: 'getFeedbackFormIdByFair', step: 'success', data: { id, feedbackFormId } }));
      return Promise.resolve({
        status: constant.GENERAL_STATUS.SUCCESS,
        data: {
          id: id ?? null,
          feedbackFormId: feedbackFormId ?? null
        }
      });
    } catch (error: any) {
      this.logger.log(JSON.stringify({ action: 'getFeedbackFormIdByFair', step: 'error', detail: error }));
      return Promise.reject({
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error),
      });
    }
  }

  public async createFeedbackFormIdByFair(fairCode: string, fairYear: string, feedbackFormId: string, emailId: string) {
    try { 
      this.logger.log(JSON.stringify({ action: 'createFeedbackFormIdByFair', step: 'start', detail: {fairCode, fairYear, emailId} }));

      const isExistFormId = await this.getFeedbackFormIdByFair(fairCode, fairYear);
      if (isExistFormId?.data?.id) {
        return Promise.reject({
          status: constant.GENERAL_STATUS.FAIL,
          message: `${fairCode} - ${fairYear} already exist config record`,
        });
      }

      const data = {
        fairCode, 
        fairYear, 
        feedbackFormId, 
        createdBy: emailId, 
        lastUpdatedBy: emailId
      };

      const result = await this.meetingConfigRepository.save(data);

      this.logger.log(JSON.stringify({ action: 'createFeedbackFormIdByFair', step: 'success', detail: result }));

      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        data: result
      };
    } catch (error: any) {
      this.logger.log(JSON.stringify({ action: 'createFeedbackFormIdByFair', step: 'error', detail: error }));
      return Promise.reject({
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error),
      });
    }
  }

  public async deleteFeedbackFormIdById(id: number, emailId: string) {
    try {
      this.logger.log(JSON.stringify({ action: 'deleteFeedbackFormIdByFair', step: 'start', detail: {id} }));

      const conditions = `( mC.id = "${id}" AND mC.deletionTime IS NULL )`;
      const queryBuilder = this.meetingConfigRepository.createQueryBuilder('mC').where(conditions);
      const formIdRecordRes = await queryBuilder.getOne();
  
      if (formIdRecordRes?.id) {
        const result = await this.meetingConfigRepository.update({ id }, { lastUpdatedBy: emailId, deletionTime: new Date() })

        this.logger.log(JSON.stringify({ action: 'deleteFeedbackFormIdByFair', step: 'success', detail: result }));
        return {
          status: constant.GENERAL_STATUS.SUCCESS,
          data: result
        }
      } else {
        return Promise.reject({
          status: constant.GENERAL_STATUS.FAIL,
          message: "meeting config dosen't exist",
        });
      }
    } catch (error: any) {
      this.logger.log(JSON.stringify({ action: 'deleteFeedbackFormIdByFair', step: 'error', detail: error }));
      return Promise.reject({
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error),
      });
    }
  }
  // *****Meeting Configuration - Feedback Form - End*****

  public async getUserLimitNo(activeFairCodeNo: number): Promise<any> {
    this.logger.log(JSON.stringify({ action: 'get', section: 'UserlimitNo', step: '1', detail: { activeFairCodeNo } }));

    let userLimitNo: number = 0;
    if (activeFairCodeNo === 1) {
      userLimitNo = 10;
    } else if (activeFairCodeNo >= 2 && activeFairCodeNo <= 3) {
      userLimitNo = 5;
    } else if (activeFairCodeNo >= 4 && activeFairCodeNo <= 5) {
      userLimitNo = 3;
    } else if (activeFairCodeNo >= 6 && activeFairCodeNo <= 7) {
      userLimitNo = 2;
    } else {
      userLimitNo = 1;
    }

    return userLimitNo;
  }

}

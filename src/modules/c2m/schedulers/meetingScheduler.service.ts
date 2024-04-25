/* eslint-disable max-len */
import { HttpStatus, Injectable } from '@nestjs/common';
import moment from 'moment';
import { Between } from 'typeorm';
import { Logger } from '../../../core/utils';
import { Meeting } from '../../../entities/meeting.entity';
import { ApiFairService } from '../../api/fair/fair.service';
import { CONFIG } from '../../cbm/cbm.type';
import { C2MService } from '../c2m.service';
import { MeetingService } from '../meeting/meeting.service';
import { MeetingStatus } from '../meeting/meeting.type';
import { ChannelType, EmailStatus, NotificationTemplatesId, NotificationType, ReceiverRole, templateSource } from '../notification/notification.type';
import { getConnection } from 'typeorm';
import { NotificationService } from '../notification/notification.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { constant } from '../../../config/constant';
import { NotificationAPIService } from '../../api/notificationAPI/notificationAPI.service';

@Injectable()
export class MeetingSchedulerService {
  private isDebug = false;
  private scheduleJobLimitDaily = 5;
  private scheduleJobLimitKickOffMeeting = 5;
  // private scheduleJobLimitExhibitorLoginReminder = 5;
  private scheduleJobLimitBuyerLoginReminder = 10;
  private scheduleJobLimitRetrySendingMeetingNoti = 5;
  // private scheduleJobLimitSeminarRegistration = 5;
  // private scheduleJobLimitSeminarSummary = 5;
  // private scheduleJobLimitRetrySendingSeminarNoti = 5;
  private scheduleJobLimitNotEnoughInterestInBmList = 5;
  private scheduleJobLimitNoResponseInBmList = 5;
  private scheduleJobLimitRetrySendingBMNoti = 5;

  constructor(
    private logger: Logger,
    private meetingService: MeetingService,
    private c2mService: C2MService,
    private apiFairService: ApiFairService,
    private notificationService: NotificationService,
    private recommendationService: RecommendationService,
    private notificationAPIService: NotificationAPIService,
  ) {}

  // ------------------------------------------------ Handling Fair Data ------------------------------------------------ //
  public getFairDataSeparately(): Promise<Record<string, any>>{
    // // ref
    // return Promise.resolve({
    //   status : 200,
    //   data: [
    //     {
    //       "fairData": [{
    //           "fairCode": "hkdgp",
    //           "eoaFairId": "1949",
    //           "fiscalYear": "2122"
    //       }],
    //       "fairDispalyName": {
    //           "en": "HKTDC Hong Kong International Diamond, Gem & Pearl Show",
    //           "sc": "香港贸发局香港国际钻石、宝石及珍珠展",
    //           "tc": "香港貿發局香港國際鑽石、寶石及珍珠展"
    //       },
    //       "fairShortName": {
    //           "en": "Diamond Show",
    //           "sc": "钻石、宝石及珍珠展",
    //           "tc": "鑽石、寶石及珍珠展"
    //       },
    //       "c2mStartDatetime": "2022-02-25 00:00",
    //       "c2mEndDatetime": "2023-02-28 23:59"
    //     },
    //     {
    //         "fairData": [{
    //             "fairCode": "hkjewellery",
    //             "eoaFairId": "1951",
    //             "fiscalYear": "2122"
    //         }],
    //         "fairDispalyName": {
    //             "en": "Hong Kong International Jewellery Show",
    //             "tc": "香港國際珠寶展",
    //             "sc": "香港国际珠宝展"
    //         },
    //         "fairShortName": {
    //             "en": "Jewellery Show",
    //             "tc": "珠寶展",
    //             "sc": "珠宝展"
    //         },
    //         "c2mStartDatetime": "2022-08-13 00:00",
    //         "c2mEndDatetime": "2023-02-28 23:59"
    //     },
    //     {
    //         "fairData": [{
    //             "fairCode": "hkelectronicsfairse",
    //             "eoaFairId": "1957",
    //             "fiscalYear": "2223"
    //         }],
    //         "fairDispalyName": {
    //             "en": "HKTDC Hong Kong Electronics Fair",
    //             "sc": "香港贸发局香港电子产品展",
    //             "tc": "香港貿發局香港電子產品展"
    //         },
    //         "fairShortName": {
    //             "en": "Spring Electronicss",
    //             "sc": "春季电子产品展",
    //             "tc": "春季電子產品展"
    //         },
    //         "c2mStartDatetime": "2022-02-25 00:00",
    //         "c2mEndDatetime": "2022-04-30 23:59"
    //     },
    //     {
    //         "fairData": [{
    //             "fairCode": "ictexpo",
    //             "eoaFairId": "1959",
    //             "fiscalYear": "2223"
    //         }],
    //         "fairDispalyName": {
    //             "en": "HKTDC Hong Kong International ICT Expo ",
    //             "sc": "香港贸发局国际资讯科技博览",
    //             "tc": "香港貿發局國際資訊科技博覽"
    //         },
    //         "fairShortName": {
    //             "en": "ICT Expo",
    //             "sc": "资讯科技博览",
    //             "tc": "資訊科技博覽"
    //         },
    //         "c2mStartDatetime": "2022-02-25 00:00",
    //         "c2mEndDatetime": "2022-04-30 23:59"
    //     }
    // ]
    // });
 
    return this.apiFairService.getFairListing()
    .then(result => {
      const fairCode: string[] = [];
      Array.isArray(result?.data?.data) && result?.data?.data.forEach((fairData: any) => {
        if (fairData?.fairCode?.length && fairData?.fairShortName?.length && fairData?.vmsProjectNo?.length) {
          fairCode.push(fairData.fairCode)
        }
      })

      if (!fairCode.length) {
        return Promise.reject({
          status: 400,
          message: "No valid fair"
        })
      }
      
      // console.log(fairCode)

      return this.apiFairService.getMultipleFairDatas(fairCode);
    })
    .then(result => {
      let pendingFairData: Record<string, any>[] = [];

      result?.data?.length && result?.data?.forEach((fairData: any) => {
        if (fairData.fairType === 'combined' && fairData?.relatedFair?.length) {
          let c2mStartDateArray: string[] = [];
          let winsEventStartDateArray: string[] = [];
          fairData?.relatedFair?.length && fairData?.relatedFair?.forEach((fair: any) => {
            c2mStartDateArray.push(fair.c2m_start_datetime);
            winsEventStartDateArray.push(fair.wins_event_start_datetime);
          })

          let earliestC2mStartDate: string;
          let earliestWinsEventStartDate: string;
          earliestC2mStartDate = c2mStartDateArray.reduce(function (pre, cur) {
            return Date.parse(pre) > Date.parse(cur) ? cur : pre;
          });
          earliestWinsEventStartDate = winsEventStartDateArray.reduce(function (pre, cur) {
            return Date.parse(pre) > Date.parse(cur) ? cur : pre;
          });

          fairData?.relatedFair?.length && fairData?.relatedFair?.forEach((fair: any) => {
            pendingFairData.push({
              fairData: [{
                fairCode: fair.fair_code,
                eoaFairId: fair.eoa_fair_id,
                fiscalYear: fair.fiscal_year
              }],
              fairDispalyName: fair.fair_display_name,
              fairShortName: fair.fair_short_name,
              c2mStartDatetime: earliestC2mStartDate,
              c2mEndDatetime: fair.c2m_end_datetime,
              winsEventStartDate: earliestWinsEventStartDate,
              winsEventEndDate: fair.wins_event_end_datetime,
            })
          })
        } else {
          fairData?.relatedFair?.length && fairData?.relatedFair?.forEach((fair: any) => {
            pendingFairData.push({
              fairData: [{
                fairCode: fair.fair_code,
                eoaFairId: fair.eoa_fair_id,
                fiscalYear: fair.fiscal_year
              }],
              fairDispalyName: fair.fair_display_name,
              fairShortName: fair.fair_short_name,
              c2mStartDatetime: fair.c2m_start_datetime,
              c2mEndDatetime: fair.c2m_end_datetime,
              winsEventStartDate: fair.wins_event_start_datetime,
              winsEventEndDate: fair.wins_event_end_datetime,
            })
          })
        }
      })
          

      if (result.data.length === 0) {
        return Promise.reject({
          status: 400,
          message: "No valid fair"
        })
      }

      return {
        status: 200,
        data: pendingFairData,
      }
    })
    .catch(error => {
      return {
        status: error?.status ?? 400,
        message: error?.message ?? JSON.stringify(error)
      }
    })
  }

  public getParsedSQLData(currFair: Record<string, any>): Record<string, any>{
    let fairCodeSQL = '';
    let fiscalYearSQL = '';
    let eoaFairIdSQL = '';
    let fairCodeString = '';
    let fiscalYearString = '';
    let eoaFairIdString = ''; 
    let fairCodeSingle = '';
    let fiscalSingle = '';
    let eoaFairIdSingle = '';

    currFair.fairData.forEach((fair: any) => {
        // init sql for in query
         if (fairCodeSQL != '') fairCodeSQL += ',';
         fairCodeSQL += "'"+fair.fairCode+"'";
       
         if (fiscalYearSQL != '') fiscalYearSQL += ',';
         fiscalYearSQL += "'"+fair.fiscalYear+"'";
 
         if (eoaFairIdSQL != '') eoaFairIdSQL += ',';
         eoaFairIdSQL += "'"+fair.eoaFairId+"'";

        // init concat value for reference key
         if (fairCodeString != '') fairCodeString += '_';
         fairCodeString += fair.fairCode;
       
         if (fiscalYearString != '') fiscalYearString += '_';
         fiscalYearString += fair.fiscalYear;
 
         if (eoaFairIdString != '') eoaFairIdString += '_';
         eoaFairIdString += fair.eoaFairId;

         // init first value for either single / combined for getting noit template 
         fairCodeSingle = (fairCodeSingle == '') ? fair.fairCode : fairCodeSingle;
         fiscalSingle = (fiscalSingle == '') ? fair.fiscalYear : fiscalSingle;
         eoaFairIdSingle = (eoaFairIdSingle == '') ? fair.eoaFairId : eoaFairIdSingle;
    });

    currFair.fairCodeSQL = fairCodeSQL;
    currFair.fiscalYearSQL = fiscalYearSQL;
    currFair.eoaFairIdSQL = eoaFairIdSQL; 
    currFair.fairCodeString = fairCodeString; 
    currFair.fiscalYearString = fiscalYearString;  
    currFair.fairCodeSingle = fairCodeSingle; 
    currFair.fiscalSingle = fiscalSingle; 
    currFair.eoaFairIdSingle = eoaFairIdSingle; 
    currFair.testingAccountUserId = ` `; 
    return currFair;
  }
  // ------------------------------------------------ End of Handling Fair Data ------------------------------------------------ //


  // ------------------------------------------------ Retry for Notification ------------------------------------------------ //
  /*
  Retry Sending Meeting Noti
  */
  public async retrySendingMeetingNoti(): Promise<any> {
    let retryTemplateId = ` 

      ${NotificationTemplatesId.CREATE_MEETING}
      ,${NotificationTemplatesId.AUTO_CANCEL_MEETING}
      ,${NotificationTemplatesId.ACCEPT_MEETING_TO_REQUESTER}
      ,${NotificationTemplatesId.ACCEPT_MEETING_TO_RESPONDER}
      ,${NotificationTemplatesId.RESCHEDULE_MEETING}
      ,${NotificationTemplatesId.REJECT_MEETING}
      ,${NotificationTemplatesId.CANCEL_MEETING}
      ,${NotificationTemplatesId.BM_CREATE_MEETING_NO_PENDING_MEETING_TO_BUYER}
      ,${NotificationTemplatesId.BM_CREATE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR}
      ,${NotificationTemplatesId.BM_CREATE_MEETING_WITH_PENDING_MEETING_TO_BUYER}
      ,${NotificationTemplatesId.BM_CREATE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR}
      ,${NotificationTemplatesId.RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR}
      ,${NotificationTemplatesId.CANCEL_BM_MEETING_BY_BUYER_OR_EXHIBITOR}
      ,${NotificationTemplatesId.CANCEL_BM_MEETING_BY_BM_TO_RESPONDER}
      ,${NotificationTemplatesId.CANCEL_BM_MEETING_BY_BM_TO_REQUESTER}
      ,${NotificationTemplatesId.CANCEL_C2M_MEETING_BY_BM_TO_REQUESTER}
      ,${NotificationTemplatesId.CANCEL_C2M_MEETING_BY_BM_TO_RESPONDER}
      ,${NotificationTemplatesId.MEETING_REMINDER}
      ,${NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_BUYER}
      ,${NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR}
      ,${NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_BUYER}
      ,${NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR}
   
    `;

    // get problem case of C2M noti
    let query = `
      SELECT 
       meeting.id as meetingRefId
      ,meeting.meetingId as meetingRefMeetingId
      ,meeting.status as meetingRefStatus
      ,meeting.*

      ,noti.id as notiRefId
      ,noti.meetingId as notiRefMeetingId
      ,noti.status as notiRefStatus    
      ,noti.*

      FROM 
        vepC2MNotification noti
      INNER JOIN vepC2MMeeting meeting ON ( meeting.id = noti.meetingId )
      WHERE
        noti.status not in ( 1,2 )
        AND noti.templateId in ( ${retryTemplateId} )
        AND retryCount < 6
      Order by noti.id asc  
      LIMIT ${this.scheduleJobLimitRetrySendingMeetingNoti}
    `;
    console.log(query);

    // connection to c2m noti and meeting
    let resultArray: Promise<any>[] = []
    return getConnection().query(query)
    .then((allRetrySendingMeetingNoti: any) => {
      if (allRetrySendingMeetingNoti.length === 0) {
        this.logger.log(JSON.stringify({
          action: `get target records`,
          section: `Notification - retrySendingMeetingNoti`,
          step: 'error',
          detail: `no target records got for sending retry noti. Result: ${JSON.stringify(allRetrySendingMeetingNoti)}`,
        }));
        return Promise.reject({
          status: 400,
          message: `no target records got for sending retry noti. Result: ${JSON.stringify(allRetrySendingMeetingNoti)}`,
        })
      }
      allRetrySendingMeetingNoti.forEach((retryNoti: any) => {
        resultArray.push(this.c2mService.handleDataForRetryMeetingNoti(retryNoti))
      });

      return Promise.all(resultArray)
    })
    .catch((error: any) => {
      this.logger.log(JSON.stringify({
        action: `retrySendingMeetingNoti catch error`,
        section: `Notification - retrySendingMeetingNoti`,
        step: 'catch error',
        detail: error?.message ?? JSON.stringify(error),
      }));
      return {
        status: error?.status ?? 400,
        message: error?.message ?? JSON.stringify(error),
      }
    });
}

  /*
  Retry Sending BM Noti
  */
  public async retrySendingBMNoti(): Promise<any> {
    let retryTemplateId = ` 
      ${NotificationTemplatesId.NEW_BM_LIST}
      ,${NotificationTemplatesId.UPDATED_BM_LIST}
      ,${NotificationTemplatesId.NO_RESPONSE_REMINDER}
      ,${NotificationTemplatesId.NOT_ENOUGH_INTEREST_REMINDER}
    `;

    // get problem case of BM noti in vepC2MNotification table
    let query = `
      SELECT 
        noti.id as notiRefId
        ,noti.meetingId as notiRefBMId
        ,noti.status as notiRefStatus    
        ,noti.*
        ,recommendation.*
      FROM 
        vep_c2m_service_db.vepC2MNotification noti
      INNER JOIN vep_c2m_service_db.vepC2MBMRecommendation recommendation ON ( recommendation.id = noti.meetingId )
      WHERE
        noti.status not in ( 1,2 )
        AND noti.templateId in ( ${retryTemplateId} )
        AND retryCount < 6
      Order by noti.id asc
      LIMIT ${this.scheduleJobLimitRetrySendingBMNoti}
    `;
    console.log(query);

    // connection to c2m noti and meeting
    // const allRetrySendingBMNoti: any[] = await getConnection().query(query);

    return getConnection().query(query)
    .then((allRetrySendingBMNoti: any[]) => {
      let resultArray: Promise<any>[] = [];
      allRetrySendingBMNoti.forEach((retryNoti: any) => {
        resultArray.push(this.c2mService.handleRetrySendingBMNoti(retryNoti));
      });
      return Promise.all(resultArray);
    })
    .catch(error => {
      this.logger.log(JSON.stringify({
        action: `Notification - retrySendingBMNoti catch error`,
        section: `Notification - retrySendingBMNoti`,
        step: 'catch error',
        detail: `step 1 error message: ${error}`
      }));
      return {
        status: constant.COMMON_CONSTANT.FAIL,
        message: `step 1 error message: ${error}`,
      }
    })
  }

  /*
  Retry Sending Seminar Noti
  */
  public async retrySendingSeminarNoti(): Promise<any> {
    let userList: any[] = [];
    let retryTemplateId = ` 
      ${NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS}
    `;

    // get problem case of seminar noti in vepC2MNotification table
    let query = `
      SELECT 
        noti.id as notiRefId
        ,noti.meetingId as notiRefSeminarId
        ,noti.status as notiRefStatus
        ,noti.creationTime as notiCreationTime
        ,noti.*
        ,seminar.*
      FROM 
        vep_c2m_service_db.vepC2MNotification noti
      INNER JOIN vepFairDb.vepFairSeminarRegistration seminar 
          ON ( seminar.id = noti.meetingId )
      WHERE
        noti.status not in ( 1,2 )
        AND noti.templateId in ( ${retryTemplateId} )
        AND retryCount < 6
      Order by noti.id asc
    `;
    // LIMIT ${this.scheduleJobLimitRetrySendingSeminarNoti}
    console.log(query);
    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    return connection.query(query, undefined, slaveRunner)
    .then((allRetrySendingSeminarNoti: any) => {

      // handle the record which is 'registration form'
      let registrationFormArray: any[] = [];
      allRetrySendingSeminarNoti.forEach((seminarNoti: any) => {
        if (seminarNoti.source === 'registration form') {
          registrationFormArray.push(seminarNoti);
        }
      });
      // console.log(registrationFormArray)

      return Promise.all([registrationFormArray, allRetrySendingSeminarNoti])
    })
    .then(([registrationFormArray, allRetrySendingSeminarNoti]: any) => {
      let filteredRegistrationFormArray: Promise<any>[] = [];
      registrationFormArray.forEach((registrationForm: any) => {
        filteredRegistrationFormArray.push(this.notificationService.filterSentNotification(registrationForm, registrationForm.notiRefId, registrationForm.refUserId ,registrationForm.refFairCode ,registrationForm.refFiscalYear ,registrationForm.channelType ,registrationForm.notiCreationTime.getFullYear(), registrationForm.notiCreationTime.getMonth() + 1, registrationForm.notiCreationTime.getDate(), registrationForm.notiCreationTime.getHours(), registrationForm.notiCreationTime.getMinutes(), registrationForm.notiCreationTime.getSeconds()))
      })

      // console.log(filteredRegistrationFormArray)

      return Promise.all([Promise.all(filteredRegistrationFormArray), allRetrySendingSeminarNoti])
    })
    .then(([filteredRegistrationFormArray, allRetrySendingSeminarNoti]: any) => {
      let userListTemp: any[] = []

      let targetRegistrationFormArray;
      targetRegistrationFormArray = filteredRegistrationFormArray.filter((filteredRegistrationForm: any) => {
        return filteredRegistrationForm.filter !== true
      })

      console.log(targetRegistrationFormArray)
      targetRegistrationFormArray.forEach((item: any) => {
        userListTemp.push(item.result)
      })
      
      userList = userListTemp.filter((element: any, index: any, self: any) =>
          index === self.findIndex((t: any) => (
            t.userId === element.userId && t.fairCode === element.fairCode && t.fiscalYear === element.fiscalYear && t.channelType === element.channelType && t.creationTime.getFullYear() === element.creationTime.getFullYear() && t.creationTime.getMonth() === element.creationTime.getMonth() && t.creationTime.getDate() === element.creationTime.getDate()
          ))
      )

      return Promise.all([allRetrySendingSeminarNoti, userList])
    })
    .then(([allRetrySendingSeminarNoti, userList]: any) => {
      // handle the record which is 'admin portal import'
      let adminImportArray: any[] = [];
      allRetrySendingSeminarNoti.forEach((seminarNoti: any) => {
        if (seminarNoti.source === 'admin portal import') {
          adminImportArray.push(seminarNoti);
        }
      });
      // console.log(adminImportArray)

      return Promise.all([adminImportArray, allRetrySendingSeminarNoti, userList])
    })
    .then(([adminImportArray, allRetrySendingSeminarNoti, userList]: any) => {
      let filteredadminImportArray: Promise<any>[] = [];
      adminImportArray.forEach((adminImport: any) => {
        filteredadminImportArray.push(this.notificationService.filterSentNotification(adminImport, adminImport.notiRefId, adminImport.refUserId ,adminImport.refFairCode ,adminImport.refFiscalYear ,adminImport.channelType ,adminImport.notiCreationTime.getFullYear(), adminImport.notiCreationTime.getMonth() + 1, adminImport.notiCreationTime.getDate(), adminImport.notiCreationTime.getHours(), adminImport.notiCreationTime.getMinutes(), adminImport.notiCreationTime.getSeconds()))
      })

      // console.log(filteredadminImportArray)

      return Promise.all([Promise.all(filteredadminImportArray), allRetrySendingSeminarNoti, userList])
    })
    .then(([filteredadminImportArray, allRetrySendingSeminarNoti, userList]: any) => {
      let targetAdminImportArray;
      let userListTemp1: any[] = [];
      let userListTemp2;
      targetAdminImportArray = filteredadminImportArray.filter((filteredAdminImport: any) => {
        return filteredAdminImport.filter !== true
      })

      console.log(targetAdminImportArray)

      targetAdminImportArray.forEach((item: any) => {
        userListTemp1.push(item.result)
      })
      
      userListTemp2 = userListTemp1.filter((element: any, index: any, self: any) =>
          index === self.findIndex((t: any) => (
            t.userId === element.userId 
            && t.fairCode === element.fairCode 
            && t.fiscalYear === element.fiscalYear 
            && t.channelType === element.channelType 
            && t.creationTime.getFullYear() === element.creationTime.getFullYear() 
            && t.creationTime.getMonth() === element.creationTime.getMonth() 
            && t.creationTime.getDate() === element.creationTime.getDate()
            && t.creationTime.getHours() === element.creationTime.getHours() 
            && t.creationTime.getMinutes() === element.creationTime.getMinutes() 
            && t.creationTime.getSeconds() === element.creationTime.getSeconds()
          ))
      )

      userListTemp2.forEach((temp: any) => {
        userList.push(temp);
      })

      return Promise.all([allRetrySendingSeminarNoti, userList])
    })
    .then(([allRetrySendingSeminarNoti, userList]: any) => {
      // handle the record which is 'intelligence hub'
      allRetrySendingSeminarNoti.forEach((seminar: any) => {
        if (seminar.source === 'intelligence hub') {
          userList.push(seminar);
        }
      });

      const resultArray: Promise<any>[] = [];
      userList.forEach((retryNoti: any) => {
        resultArray.push(this.c2mService.prepareDataForRetrySendingSeminarNoti(retryNoti, allRetrySendingSeminarNoti));
      });

      return Promise.all(resultArray);
    })
    .catch((error) => ({
      status: constant.GENERAL_STATUS.FAIL,
      result: `error: ${error}`,
    }))
    .finally(() => {
      slaveRunner.release();
    })
  }

  /*
  Retry Sending Seminar Summary Noti
  */
  public async retrySendingSeminarSummaryNoti(): Promise<any> {
    let retryTemplateId = ` 
      ${NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER},
      ${NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER}
    `;

    // get problem case of seminar summary noti in vepC2MNotification table
    let query = `
      SELECT 
        noti.id as notiRefId
        ,noti.meetingId as notiRefSeminarId
        ,noti.status as notiRefStatus
        ,noti.creationTime as notiCreationTime
        ,noti.*
        ,seminar.*
      FROM 
        vep_c2m_service_db.vepC2MNotification noti
      INNER JOIN vepFairDb.vepFairSeminarRegistration seminar
        ON ( noti.refUserId = seminar.userId
          AND noti.refFairCode = seminar.fairCode 
          AND noti.refFiscalYear = seminar.fiscalYear
          AND noti.meetingId = seminar.seminarId
        )
      WHERE
        noti.status not in ( 1,2 )
        AND noti.templateId in ( ${retryTemplateId} )
        AND retryCount < 6
      Order by noti.id asc
    `;
    // LIMIT ${this.scheduleJobLimitRetrySendingSeminarNoti}
    console.log(query);
    // connection to c2m noti and meeting
    let allRetrySendingSeminarSummaryNoti: any[] = [];
    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    try {
      allRetrySendingSeminarSummaryNoti = await connection.query(query, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in retrySendingSeminarSummaryNoti api", error);
    } finally {
      slaveRunner.release();
    }

    let userList: any[] = [];
    userList = allRetrySendingSeminarSummaryNoti.filter((element, index, self) =>
        index === self.findIndex((t) => (
          t.userId === element.userId && t.fairCode === element.fairCode && t.fiscalYear === element.fiscalYear && t.notificationContent === element.notificationContent
        ))
    )

    const resultArray: Promise<any>[] = [];
    userList.forEach((retryNoti: any) => {
      resultArray.push(this.c2mService.prepareDataForRetrySendingSeminarSummaryNoti(retryNoti, allRetrySendingSeminarSummaryNoti));
    });

    return Promise.all(resultArray);
  }
  // ------------------------------------------------ End of Retry for Notification ------------------------------------------------ //


  // ------------------------------------------------ R2A Notification ------------------------------------------------ //
  /*
  AUTO CANCEL MEETING

  Internval : Every Min

  Handling auto cancel for pending meeting(10May2022 whatsapp; prev: 48 72)
  New meeting : Meeting requested over 72 hours.
  Reschedule meeting : Meeting requested over 96 hours.
  */
  public async cancelPendingMeetingsOverHrs(): Promise<Meeting[]> {
    const meetings: Meeting[] = await this.meetingService.findPendingMeetingOverHrs();

    const meetingsToBeAutoCancelled: Meeting[] = meetings.map((m: Meeting) => {
      const creationTime = moment(m.creationTime);

      if (moment().subtract(72, 'h').isAfter(creationTime) && m.rescheduledTime === 0) {
        m.cancelledReason = 'Meeting requested over 72 hours.';
      } else if (moment().subtract(96, 'h').isAfter(creationTime) && m.rescheduledTime > 0) {
        m.cancelledReason = 'Meeting requested over 96 hours.';
      }

      return m;
    });

    const autoCancelledMeetings: Meeting[] = await this.meetingService.updateMeetingsToAutoCancelled(meetingsToBeAutoCancelled);

    meetingsToBeAutoCancelled.forEach(async (meeting: Meeting) => {
      await this.c2mService.handleNotification({
        templateId: NotificationTemplatesId.AUTO_CANCEL_MEETING, 
        notificationType: NotificationType.AUTO_CANCEL_MEETING, 
        meetingData: meeting, 
        fairCode: meeting.fairCode, 
        isRequester: true,
        skipWebNotifiction: false
      });
    });

    const cancelledMeetingIds = autoCancelledMeetings.map((m: Meeting) => m.id).join() || 'N/A';

    this.logger.log(`Auto cancelled meetings: ${cancelledMeetingIds}`);

    return autoCancelledMeetings;
  }

  /*
  C2M 15mins Meeting Reminder

  Internval : Every Min

  Send reminder to user who has meeting in incoming 15mins
  Supported Combined Fair
  */
  public async findUpcomingMeeingsOver15Min(): Promise<any> {
    // utc 0
    moment().utc();

    // handle config value - Minutes before sent out meeting reminder
    let upComingBeforeMin: number;
    const upComingBeforeMinConfigResult = await this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_MEETING_REMINDER_MINUTE.id });
    const upComingBeforeMinConfig = upComingBeforeMinConfigResult?.data?.configValue;
    upComingBeforeMin = Number(upComingBeforeMinConfig);
    if (upComingBeforeMinConfigResult.status !== 200 || !upComingBeforeMinConfigResult) {
      this.logger.log(JSON.stringify({ action: 'get config value (minutes before sent out)', section: 'findUpcomingMeeingsOver15Min', step: '1', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_MEETING_REMINDER_MINUTE.id} config value` }));
      return;
    }
    console.log(`Minutes before sent out meeting reminder in c2mConfig table: ${upComingBeforeMin}`);

    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    const startTimebefore15Mins = moment(now).add(upComingBeforeMin, 'minutes').format('YYYY-MM-DD HH:mm:ss');
    // const startTimebefore15Mins = moment(now).add(upComingBeforeMin, "minutes").format('YYYY-MM-DD HH:mm:ss');

    return this.meetingService.findByParams({
      relations: ['notification'],
      where: {
        status: MeetingStatus.ACCEPTED,
        startTime: Between(now, startTimebefore15Mins)
      }
    })
    .then(async (result: Meeting[]) => {
      result.forEach(async(record: Meeting) => {
        const targetNotification = record.notification.filter((notification) => notification.notificationType === NotificationType.MEETING_REMINDER);
        if (!targetNotification.length) {
          await this.c2mService.handleNotification({
            templateId: NotificationTemplatesId.MEETING_REMINDER,
            notificationType: NotificationType.MEETING_REMINDER,
            meetingData: record, 
            fairCode: record.fairCode, 
            isRequester: true,
            skipWebNotifiction: false
          });
          await this.c2mService.handleNotification({
            templateId: NotificationTemplatesId.MEETING_REMINDER,
            notificationType: NotificationType.MEETING_REMINDER,
            meetingData: record, 
            fairCode: record.fairCode, 
            isRequester: false,
            skipWebNotifiction: false
          });
        }

        // Retry sendNoti Function
        // const templateId = NotificationTemplatesId.MEETING_REMINDER;
        // const notificationType = NotificationType.MEETING_REMINDER;
        // this.c2mService.sendNotiRetry(record, targetNotification, templateId, notificationType)
      });
      return Promise.all(result);
    })
    .catch((error: any) => {
      this.logger.log(JSON.stringify({ action: 'catch error', section: 'findUpcomingMeeingsOver15Min', step: 'error', detail: `${error ?? JSON.stringify(error)}` }));
      return {
        status: HttpStatus.BAD_REQUEST,
        message: error ?? JSON.stringify(error),
      };
    });
  }
  // ------------------------------------------------ End of R2A Notification ------------------------------------------------ //


  // ------------------------------------------------ R2A Summary Notification ------------------------------------------------ //
  public async C2MMeetingReminder(action : string): Promise<any> {
    const activeFair = await this.getFairDataSeparately();
    if (activeFair.status !== 200) {
      this.logger.log(JSON.stringify({ action: 'get fair data separately', section: 'Notification - C2MMeetingReminder', step: 'error', detail: `cannot get the fair data in ${action}. Return value from getFairDataSeparately(): ${JSON.stringify(activeFair)}` }));
      return ({
        status: 400,
        message: `cannot get the fair data in ${action}. Return value from getFairDataSeparately(): ${JSON.stringify(activeFair)}`
      });
    }
    
    const activeFairCodeNo = activeFair.data.length
    const scheduleJobLimit = await this.c2mService.getUserLimitNo(activeFairCodeNo)


    let currentDateHKT = moment().tz('Asia/Hong_Kong').format("YYYY-MM-DD");
    // handle config value - Time of sending c2m kick off email
    let KickOffSendingTimeHKT: moment.Moment;
    // handle config value - No. of days before C2M end day
    let kickOffMeetingNoOfDayBeforeStartDay: number;
    // handle config value - Time of sending buyer kick off email
    let buyerKickOffSendingTimeHKT: moment.Moment;
    // handle config value - Interval (day) of checking buyer kick off email
    let buyerKickOffIntervalOfDay: number;
    // handle config value - Time of sending daily kick off email
    let dailySendingTimeHKT: moment.Moment;
    // handle config value - Interval (day) of checking daily email
    let dailyIntervalOfDay: number;

    if (action === 'KickOffMeetingReminder') {
      // handle config value - Time of sending
      const KickOffSendingTimeConfigResult = await this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_C2M_START_REMINDER_TIME.id });
      const KickOffSendingTimeConfig = KickOffSendingTimeConfigResult?.data?.configValue;
      if (KickOffSendingTimeConfigResult.status !== 200 || !KickOffSendingTimeConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (sending time)', section: 'Notification - KickOffMeetingReminder', step: '1', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_C2M_START_REMINDER_TIME.id} config value, API response: ${KickOffSendingTimeConfigResult}` }));
        return ({
          status: 400,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_C2M_START_REMINDER_TIME.id} config value, API response: ${KickOffSendingTimeConfigResult}`
        });
      }

      // handle config value - No. of days before C2M start day
      const kickOffMeetingNoOfDayBeforeStartDayConfigResult = await this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_C2M_START_REMINDER_DAY.id });
      const kickOffMeetingNoOfDayBeforeStartDayConfig = kickOffMeetingNoOfDayBeforeStartDayConfigResult?.data?.configValue;
      if (kickOffMeetingNoOfDayBeforeStartDayConfigResult.status !== 200 || !kickOffMeetingNoOfDayBeforeStartDayConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (no of day before)', section: 'KickOffMeetingReminder', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_C2M_START_REMINDER_DAY.id} config value, API response: ${kickOffMeetingNoOfDayBeforeStartDayConfigResult}` }));
        return ({
          status: 400,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_C2M_START_REMINDER_DAY.id} config value, API response: ${kickOffMeetingNoOfDayBeforeStartDayConfigResult}`
        });
      }

      // KickOffSendingTimeHKT = moment.tz(KickOffSendingTimeConfig, 'HH:mm', 'Asia/Hong_Kong');
      let KickOffSendingTimeHKTString = currentDateHKT + 'T' + KickOffSendingTimeConfig + ':00'
      KickOffSendingTimeHKT  = moment.tz(KickOffSendingTimeHKTString, 'Asia/Hong_Kong');
      kickOffMeetingNoOfDayBeforeStartDay = Number(kickOffMeetingNoOfDayBeforeStartDayConfig);
    }

    if (action === 'buyerLoginReminder') {
      // handle config value - Time of sending
      const buyerKickOffSendingTimeConfigResult = await this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_C2M_KICK_OFF_BUYER_TIME.id });
      const buyerKickOffSendingTimeConfig = buyerKickOffSendingTimeConfigResult?.data?.configValue;
      if (buyerKickOffSendingTimeConfigResult.status !== 200 || !buyerKickOffSendingTimeConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (sending time)', section: 'Notification - buyerLoginReminder', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_C2M_KICK_OFF_BUYER_TIME.id} config value, API response: ${buyerKickOffSendingTimeConfigResult}` }));
        return ({
          status: 400,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_C2M_KICK_OFF_BUYER_TIME.id} config value, API response: ${buyerKickOffSendingTimeConfigResult}`
        });
      }

      // handle config value - Interval of days
      const buyerKickOffIntervalOfDayConfigResult = await this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_C2M_KICK_OFF_BUYER_DAY.id });
      const buyerKickOffIntervalOfDayConfig = buyerKickOffIntervalOfDayConfigResult?.data?.configValue;
      if (buyerKickOffIntervalOfDayConfigResult.status !== 200 || !buyerKickOffIntervalOfDayConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (interval of day)', section: 'buyerLoginReminder', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_C2M_KICK_OFF_BUYER_DAY.id} config value, API response: ${buyerKickOffIntervalOfDayConfigResult}` }));
        return ({
          status: 400,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_C2M_KICK_OFF_BUYER_DAY.id} config value, API response: ${buyerKickOffIntervalOfDayConfigResult}`
        });
      }

      // buyerKickOffSendingTimeHKT = moment.tz(buyerKickOffSendingTimeConfig, 'HH:mm', 'Asia/Hong_Kong');
      let buyerKickOffSendingTimeHKTString = currentDateHKT + 'T' + buyerKickOffSendingTimeConfig + ':00'
      buyerKickOffSendingTimeHKT  = moment.tz(buyerKickOffSendingTimeHKTString, 'Asia/Hong_Kong');
      buyerKickOffIntervalOfDay = Number(buyerKickOffIntervalOfDayConfig);

      console.log(`when current time >= ${buyerKickOffSendingTimeHKT.format('HH:mm')}, every ${buyerKickOffIntervalOfDay} day check the buyer kick off noti need to send or not`);
    }

    if (action === 'dailyMeetingReminder') {
      // handle config value - Time of sending
      const dailySendingTimeConfigResult = await this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_DAILY_MEETING_SUMMARY_TIME.id });
      const dailySendingTimeConfig = dailySendingTimeConfigResult?.data?.configValue;
      if (dailySendingTimeConfigResult.status !== 200 || !dailySendingTimeConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (sending time)', section: 'Notification - buyerLoginReminder', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_C2M_KICK_OFF_BUYER_TIME.id} config value, API response: ${dailySendingTimeConfigResult}` }));
        return ({
          status: 400,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_C2M_KICK_OFF_BUYER_TIME.id} config value, API response: ${dailySendingTimeConfigResult}`
        });
      }

      // handle config value - Interval of days to send out daily meeting summary
      const dailyIntervalOfDayConfigResult = await this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_DAILY_MEETING_SUMMARY_DAY.id });
      const dailyIntervalOfDayConfig = dailyIntervalOfDayConfigResult?.data?.configValue;
      if (dailyIntervalOfDayConfigResult.status !== 200 || !dailyIntervalOfDayConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (interval of day)', section: 'Notification - dailyMeetingReminder', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_DAILY_MEETING_SUMMARY_DAY.id} config value, API response: ${dailyIntervalOfDayConfigResult}` }));
        return ({
          status: 400,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_DAILY_MEETING_SUMMARY_DAY.id} config value, API response: ${dailyIntervalOfDayConfigResult}`
        });
      }

      // dailySendingTimeHKT = moment.tz(dailySendingTimeConfig, 'HH:mm', 'Asia/Hong_Kong');
      let dailySendingTimeHKTString = currentDateHKT + 'T' + dailySendingTimeConfig + ':00'
      dailySendingTimeHKT  = moment.tz(dailySendingTimeHKTString, 'Asia/Hong_Kong');
      dailyIntervalOfDay = Number(dailyIntervalOfDayConfig);

      console.log(`when current time >= ${dailySendingTimeHKT.format('HH:mm')}, every ${dailyIntervalOfDay} day check the daily summary noti need to send or not`);
    }

    const finalResult: Promise<any>[] = [];
    activeFair?.data?.forEach(async (currFair: any) => {
        console.log(currFair.fairData);
        console.log('fairStartTime : ' + currFair.c2mStartDatetime);
        console.log('fairEndTime : ' + currFair.c2mEndDatetime);
        console.log('winsEventStartTime : ' + currFair.winsEventStartDate);

        const timeZone = 'Asia/Hong_Kong';
        // set current time - UTC
        const currentTime = moment().utc();
        // set current time - HKT
        const currentTimeHKT = moment().tz('Asia/Hong_Kong');
        // set current date to 00:00:00 - HKT
        const currentDateHKT = moment().tz('Asia/Hong_Kong').startOf('day');

        // convert winsEventStartDate from string to moment - HKT
        // const fairwinsStartTimeHKT = moment.tz(currFair.winsEventStartDate, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong');
        // set winsEventStartDate to 00:00:00 - HKT
        const fairwinsStartDateHKT = moment.tz(currFair.winsEventStartDate, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong').startOf('day');

        // convert c2mStartDate from string to moment - HKT
        // const fairStartTimeHKT = moment.tz(currFair.c2mStartDatetime, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong');
        // set c2mStartDate to 00:00:00 - HKT
        const fairStartDateHKT = moment.tz(currFair.c2mStartDatetime, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong').startOf('day');

        // get the difference of days between c2mStartDate and currentDate - HKT
        const diffWinsEventDate = moment.duration(currentDateHKT.diff(fairwinsStartDateHKT)).asDays();
        // get the difference of days between c2mStartDate and currentDate - HKT
        const diffDate = moment.duration(currentDateHKT.diff(fairStartDateHKT)).asDays();

        // set wins event start time - UTC
        const winsEventStartTime = moment.tz(currFair.winsEventStartDate, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong').utc();
        // set fair start time - UTC
        const fairStartTime = moment.tz(currFair.c2mStartDatetime, 'YYYY-MM-DD HH:mm', timeZone).utc();
        // set fair end time - UTC
        const fairEndTime = moment.tz(currFair.c2mEndDatetime, 'YYYY-MM-DD HH:mm', timeZone).utc();

        // compare if current is blasting time - UTC
        const isBetweenC2MPeriod = currentTime.isBetween(fairStartTime, fairEndTime);
        // compare if current is blasting time - UTC
        const isBetweenWinsEventPeriod = currentTime.isBetween(winsEventStartTime, fairEndTime);

        const parsedcurrFairData = this.getParsedSQLData(currFair);

        // let currentDayEndTimeHKT: moment.Moment = moment().tz('Asia/Hong_Kong').endOf('day')
        // let isBetweenSendingPeriod: boolean;

        switch (action) {
          case 'KickOffMeetingReminder':
            // handle config value - No. of days before C2M start day
            let fairStartTimeNDayBefore: moment.Moment;

            fairStartTimeNDayBefore = moment.tz(currFair.winsEventStartDate, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong').subtract(kickOffMeetingNoOfDayBeforeStartDay, 'd').utc();

            const fairStartTimeNDayBeforeEnd = moment(fairStartTimeNDayBefore, 'YYYY-MM-DD HH:mm').add(1, 'd').utc();
            console.log(`Before C2M start day: ${fairStartTimeNDayBefore}`);
            console.log(`Before C2M start day + 1 day: ${fairStartTimeNDayBeforeEnd}`);

            let isBetweenC2MReminderPeriod = currentTime.isBetween(fairStartTimeNDayBefore, fairStartTimeNDayBeforeEnd);
            console.log(`When current time >= ${KickOffSendingTimeHKT.format('HH:mm')}, and current date (${currentTime}) is between ${fairStartTimeNDayBefore} and ${fairStartTimeNDayBeforeEnd}`);

            let currentDayEndTimeHKTForKickOff: moment.Moment = moment().tz('Asia/Hong_Kong').endOf('day')
            let isBetweenSendingPeriodForKickOff: boolean = currentTimeHKT.isBetween(KickOffSendingTimeHKT, currentDayEndTimeHKTForKickOff);
            console.log(`currentTime: ${currentTimeHKT}, sendingTime: ${KickOffSendingTimeHKT}, currentTimeDayEnd: ${currentDayEndTimeHKTForKickOff}`);

            if ((isBetweenC2MReminderPeriod) && (isBetweenSendingPeriodForKickOff)) {
              finalResult.push(this.handleKickOffMeetingReminderPerFair(parsedcurrFairData))
            }
          break;

          case 'exhibitorLoginReminder':
            if ((isBetweenC2MPeriod && currFair?.fairData[0]?.eoaFairId !== undefined) && (diffDate % 3 === 0)) {
              finalResult.push(this.handleKickOffExhibitorReminder(parsedcurrFairData, scheduleJobLimit));
            }
          break;

          case 'buyerLoginReminder':
            let currentDayEndTimeHKTForBuyer: moment.Moment = moment().tz('Asia/Hong_Kong').endOf('day')
            let isBetweenSendingPeriodForBuyer: boolean = currentTimeHKT.isBetween(buyerKickOffSendingTimeHKT, currentDayEndTimeHKTForBuyer);
            console.log(`currentTime(Asia/Hong_Kong): ${currentTimeHKT}, sendingTime(Asia/Hong_Kong): ${buyerKickOffSendingTimeHKT}, currentTimeDayEnd(Asia/Hong_Kong): ${currentDayEndTimeHKTForBuyer}`);

            if (isBetweenC2MPeriod && (diffDate % buyerKickOffIntervalOfDay === 0) && (isBetweenSendingPeriodForBuyer)) {
              finalResult.push(this.handleKickOffBuyerReminder(parsedcurrFairData, scheduleJobLimit));
            }
          break;

          case 'dailyMeetingReminder':
            let currentDayEndTimeHKTForDaily: moment.Moment = moment().tz('Asia/Hong_Kong').endOf('day')
            let isBetweenSendingPeriodForDaily: boolean = currentTimeHKT.isBetween(dailySendingTimeHKT, currentDayEndTimeHKTForDaily);
            console.log(`currentTime(Asia/Hong_Kong): ${currentTimeHKT}, sendingTime(Asia/Hong_Kong): ${dailySendingTimeHKT}, currentTimeDayEnd(Asia/Hong_Kong): ${currentDayEndTimeHKTForDaily}`);
          
            if ((isBetweenWinsEventPeriod) && (diffWinsEventDate % (dailyIntervalOfDay + 1) === 0) && (isBetweenSendingPeriodForDaily)) {
              finalResult.push(this.handleDailyMeetingReminder(parsedcurrFairData));
            }
          break;

          case 'noResponseInBmListReminder':
            if (isBetweenC2MPeriod) {
              finalResult.push(this.noResponseInBmList(parsedcurrFairData));
            }
          break;

          case 'notEnoughInterestInBmListReminder':
            if (isBetweenC2MPeriod) {
              finalResult.push(this.notEnoughInterestInBmList(parsedcurrFairData));
            }
          break;

          default:
            console.log('Invalid Action');
          break;
        }
    });

    return Promise.all(finalResult);
  }

  /*
  C2M Kick off Reminder

  Internval : Every Min

  Send reminder to user 1 Day before c2m start day.  It wont send after c2m start day
  Supported Combined Fair
  */
  public async handleKickOffMeetingReminderPerFair(currFair: Record<string, any>): Promise<any> {
    let debugRequesterSsoUidSQL = '';
    let debugResponderSsoUidSQL = '';
    if (this.isDebug) {
      debugRequesterSsoUidSQL = ` AND requesterSsoUid in (${currFair.testingAccountUserId})  `;
      debugResponderSsoUidSQL = ` AND responderSsoUid in (${currFair.testingAccountUserId})  `;
    }

    // get user of daily summary that not sent yet
    let query = `
        select kickoff.*  from 
        (
                SELECT 
                  requesterSsoUid as userId,
                  fiscalYear as fiscalYear
                FROM 
                  vepC2MMeeting  
                WHERE 
                  status = ${MeetingStatus.ACCEPTED}  
                  AND fairCode in (${currFair.fairCodeSQL})
                  AND fiscalYear in (${currFair.fiscalYearSQL})
                  ${debugRequesterSsoUidSQL}                 
                group by requesterSsoUid , fairCode, fiscalYear  
            UNION
                SELECT  
                  responderSsoUid as userId,
                  responderFiscalYear as fiscalYear
                FROM 
                  vepC2MMeeting  
                WHERE 
                  status = ${MeetingStatus.ACCEPTED} 
                  AND responderFairCode in (${currFair.fairCodeSQL})
                  AND responderFiscalYear in (${currFair.fiscalYearSQL}) 
                  ${debugResponderSsoUidSQL}                   
                group by responderSsoUid , responderFairCode, responderFiscalYear 
        ) kickoff
          LEFT JOIN vepC2MNotification noti 
          ON ( noti.refUserId = kickoff.userId
            AND noti.refFairCode = '${currFair.fairCodeString}'
            AND noti.refFiscalYear = '${currFair.fiscalYearString}'
            AND noti.notificationType = '${NotificationType.C2M_START_REMINDER}' 
            
            )
        WHERE noti.id is null
        LIMIT ${this.scheduleJobLimitKickOffMeeting}
    `;

    console.log(query);
    this.logger.log(JSON.stringify({ action: 'query', section: 'Notification - handleKickOffMeetingReminderPerFair', step: '1', detail: `query: ${query}` }));

    return getConnection().query(query)
    .then((allUsers: any) => {
      if (allUsers.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target fair', section: 'Notification - handleKickOffMeetingReminderPerFair', step: 'error', detail: `no notification need to send (no target buyer found fairCode: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})` }));
        return Promise.reject({
          status: 400,
          message: `no notification need to send (no target exhibitors found fairCode: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})`
        });
      }

      return Promise.all([allUsers, this.notificationAPIService.getMessageBodyForSns({ templateId: NotificationTemplatesId.C2M_START_REMINDER, templateSource: templateSource.DIRECT })])
    })
    .then(([allUsers, messageBodyTemplate]) => {
      if (messageBodyTemplate.status === 400 && !messageBodyTemplate.data) {
        this.logger.log(JSON.stringify({ action: 'getMessageBodyForSns', section: `Notification - handleKickOffMeetingReminderPerFair`, step: 'error', detail: `Request failed ${NotificationTemplatesId.C2M_START_REMINDER} ${currFair.fairCodeSQL}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}` }));
        return Promise.reject(`Request failed ${NotificationTemplatesId.C2M_START_REMINDER} ${currFair.fairCodeSQL}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}`);
      }

      const returnResult: Promise<any>[] = [];
      allUsers.forEach((user: any) => {
        returnResult.push(
          this.c2mService.handleNotificationForSummary({
            userData: user,
            currFair,
            summaryDate: null,
            messageBodyTemplate,
          })
        )
      });
      return Promise.all(returnResult);
    })
    .catch((error: any) => {
      this.logger.log(JSON.stringify({ action: 'catch error', section: 'Notification - handleKickOffMeetingReminderPerFair', step: 'error', detail: `${JSON.stringify(error)}` }));
      return {
        status: HttpStatus.BAD_REQUEST,
        message: error ?? JSON.stringify(error),
      };
    });
  }

  /*
  C2M Reminder - Exhibitor didnt login

  Internval : Every Min

  Send reminder to exhibitor that didnt login c2m every 3days on of after C2M start day
  Supported Combined Fair
  */
  public async handleKickOffExhibitorReminder(currFair: Record<string, any>, scheduleJobLimit: number): Promise<any> {
    const reminderNotiType = NotificationType.C2M_KICK_OFF_EXHIBITOR + '_' +  moment().tz('Asia/Hong_Kong').format('YYYY_MM_DD');
    let debugSsoUidSQL = '';
    if (this.isDebug) {
      debugSsoUidSQL = ` AND exhibitor.companyCcdid in (${currFair.testingAccountUserId})  `;
    }

    //get exhibitor who never login and remind them ( not yet include every 3days concept )
    let query = `
    SELECT 
      exhibitor.contactEmail AS emailId,
      exhibitor.companyCcdid AS userId,
      exhibitor.firstName, 
      exhibitor.lastName, 
      exhibitor.c2mLogin, 
      exhibitor.c2mMeetingLogin,
      exhibitor.eoaFairId
    FROM 
      vepExhibitorDb.vepExhibitor exhibitor 
    LEFT JOIN vepExhibitorDb.vepC2MNotification noti 
      ON ( noti.refUserId = exhibitor.companyCcdid  
      AND noti.refEoaFairId = exhibitor.eoaFairId
      AND noti.notificationType = '${reminderNotiType}' 
        )      
    WHERE exhibitor.companyCcdId is not NULL 
      AND exhibitor.deletionTime < '1980-01-01 00:00:00' 
      AND exhibitor.vepExhibitorRegistrationStatusId = 1 
      AND exhibitor.c2mParticipantStatusId = 1 
      AND exhibitor.c2mLogin is null
      AND exhibitor.eoaFairId in (${currFair.eoaFairIdSQL})
      ${debugSsoUidSQL}
      AND noti.id is null
      LIMIT ${scheduleJobLimit}
    `;

    console.log(query);
    this.logger.log(JSON.stringify({ action: 'query', section: 'Notification - handleKickOffExhibitorReminder', step: '1', detail: `query: ${query}` }));

    return getConnection('exhibitorDatabaseForWrite').query(query)
    .then((allTargetExhibitors: any) => {
      if (allTargetExhibitors.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target fair', section: 'Notification - handleKickOffExhibitorReminder', step: 'error', detail: `no notification need to send (no target buyer found fairCode: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})` }));
        return Promise.reject({
          status: 400,
          message: `no notification need to send (no target exhibitors found fairCode: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})`
        });
      }

      return Promise.all([allTargetExhibitors, this.notificationAPIService.getMessageBodyForSns({ templateId: NotificationTemplatesId.C2M_KICK_OFF_EXHIBITOR, templateSource: templateSource.DIRECT })])
    })
    .then(([allTargetExhibitors, messageBodyTemplate]) => {
      if (messageBodyTemplate.status === 400 && !messageBodyTemplate.data) {
        this.logger.log(JSON.stringify({ action: 'getMessageBodyForSns', section: `Notification - handleKickOffExhibitorReminder`, step: 'error', detail: `Request failed ${NotificationTemplatesId.C2M_KICK_OFF_EXHIBITOR} ${currFair.fairCodeSQL}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}` }));
        return Promise.reject(`Request failed ${NotificationTemplatesId.C2M_KICK_OFF_EXHIBITOR} ${currFair.fairCodeSQL}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}`);
      }

      const returnResult: Promise<any>[] = [];
      allTargetExhibitors.forEach((exhibitor: any) => {
        returnResult.push(
          this.c2mService.handleNotificationForKickOff({
            templateId: NotificationTemplatesId.C2M_KICK_OFF_EXHIBITOR,
            notificationType: reminderNotiType,
            receiverRole: ReceiverRole.EXHIBITOR,
            userData: exhibitor,
            currFair,
            messageBodyTemplate,
          })
        )
      });
      return Promise.all(returnResult);
    })
    .catch((error: any) => {
      this.logger.log(JSON.stringify({ action: 'catch error', section: 'Notification - handleKickOffExhibitorReminder', step: 'error', detail: `${JSON.stringify(error)}` }));
      return {
        status: HttpStatus.BAD_REQUEST,
        message: error ?? JSON.stringify(error),
      };
    });
  }

  /*
  C2M Reminder - Buyer didnt login

  Internval : Every Min

  Send reminder to Buyer that didnt login && has AI recommendation c2m every N days at xx:xx within C2M period
  Supported Combined Fair
  */
  public async handleKickOffBuyerReminder(currFair: Record<string, any>, scheduleJobLimit: number): Promise<any> {
    const reminderNotiType = NotificationType.C2M_KICK_OFF_BUYER + '_' +  moment().tz('Asia/Hong_Kong').format('YYYY_MM_DD');
  
    let debugSsoUidSQL =  '';
    if(this.isDebug){
      debugSsoUidSQL =  ` AND participant.ssoUid in (${currFair.testingAccountUserId})  `; 
    }

    let query = `
    Select 
      participant.emailId, 
      participant.ssoUid AS userId,
      registration.firstName, 
      registration.lastName, 
      registration.fairCode, 
      registration.fiscalYear, 
      registration.c2mLogin, 
      registration.c2mMeetingLogin,
      registration.c2mParticipantStatusId,
      CONCAT(registration.serialNumber, SUBSTRING(registration.projectYear, 3, 2), registration.sourceTypeCode, registration.visitorTypeCode, registration.projectNumber) AS registrationNo 
    FROM 
      vepFairDb.fairRegistration registration 
    INNER JOIN vepFairDb.fairParticipant participant ON participant.id = registration.fairParticipantId 
    LEFT JOIN vepFairDb.vepC2MNotification noti 
      ON ( noti.refUserId = participant.ssoUid
      AND noti.refFairCode = registration.fairCode
      AND noti.refFiscalYear = registration.fiscalYear
      AND noti.notificationType = '${reminderNotiType}'  
        )    
    WHERE participant.ssoUid is not null
      AND participant.deletionTime < '1980-01-01 00:00:00'
      AND registration.deletionTime < '1980-01-01 00:00:00'
      AND registration.fairRegistrationStatusId = 1 
      AND (registration.c2mParticipantStatusId = 1 OR registration.c2mParticipantStatusId = 2 OR registration.c2mParticipantStatusId = 3)
      AND registration.c2mLogin is null
      AND registration.fairCode in (${currFair.fairCodeSQL})
      AND registration.fiscalYear in (${currFair.fiscalYearSQL})
      AND noti.id is null   
      ${debugSsoUidSQL}
      LIMIT ${this.scheduleJobLimitBuyerLoginReminder}
    `;
    // LIMIT ${scheduleJobLimit}

    console.log(query);
    this.logger.log(JSON.stringify({ action: 'query', section: 'Notification - handleKickOffBuyerReminder', step: '1', detail: `query: ${query}` }));

    return getConnection('buyerDatabaseForWrite').query(query)
    .then((allTargetBuyers: any) => {
      if (allTargetBuyers.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target fair', section: 'Notification - handleKickOffBuyerReminder', step: 'error', detail: `no notification need to send (no target buyer found fairCode: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})` }));
        return Promise.reject(`no notification need to send (no target buyer found fairCode: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})`);
      }

      return Promise.all([allTargetBuyers, this.notificationAPIService.getMessageBodyForSns({ templateId: NotificationTemplatesId.C2M_KICK_OFF_BUYER, templateSource: templateSource.DIRECT })])
    })
    .then(([allTargetBuyers, messageBodyTemplate]) => {
      if (messageBodyTemplate.status === 400 && !messageBodyTemplate.data) {
        this.logger.log(JSON.stringify({ action: 'getMessageBodyForSns', section: `Notification - handleKickOffBuyerReminder`, step: 'error', detail: `Request failed ${NotificationTemplatesId.C2M_KICK_OFF_BUYER} ${currFair.fairCodeSQL}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}` }));
        return Promise.reject(`Request failed ${NotificationTemplatesId.C2M_KICK_OFF_BUYER} ${currFair.fairCodeSQL}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}`);
      }
      
      const returnResult: Promise<any>[] = [];
      allTargetBuyers.forEach((buyer: any) => {
        returnResult.push(
          this.recommendationService.findRecommendedExhibitorForNoti(buyer.fairCode, buyer.fiscalYear, buyer.userId, buyer.c2mParticipantStatusId)
          .then(async (recommendExhibitorResult: any) => {
            if (recommendExhibitorResult.status === HttpStatus.BAD_REQUEST) {
              this.logger.log(JSON.stringify({ action: 'get target fair', section: 'handleKickOffBuyerReminder', step: 'error', detail: `recommendExhibitorResult not found (ssoUid: ${buyer.userId}, fairCode: ${buyer.fairCode}, fiscalYear: ${buyer.fiscalYear})` }));
              
              await this.notificationService.createNotificationRecordInFairDb({ 
                meetingId: 0, 
                refUserId: buyer.userId, 
                refFairCode: currFair.fairCodeString, 
                refFiscalYear: currFair.fiscalYearString, 
                templateId: NotificationTemplatesId.C2M_KICK_OFF_BUYER, 
                channelType: ChannelType.EMAIL,
                notificationType: reminderNotiType,
                receiverRole: 'ERROR',
                notificationContent: `ERROR: ${JSON.stringify(recommendExhibitorResult.message)} (ssoUid: ${buyer.userId}, fairCode: ${buyer.fairCode}, fiscalYear: ${buyer.fiscalYear})`,
                status: EmailStatus.NO_NEED_TO_SEND,
              })
              
              await this.notificationService.createNotificationRecordInFairDb({ 
                meetingId: 0, 
                refUserId: buyer.userId, 
                refFairCode: currFair.fairCodeString, 
                refFiscalYear: currFair.fiscalYearString, 
                templateId: NotificationTemplatesId.C2M_KICK_OFF_BUYER, 
                channelType: ChannelType.WEB_NOTIFICATION,
                notificationType: reminderNotiType,
                receiverRole: 'ERROR',
                notificationContent: `ERROR: ${JSON.stringify(recommendExhibitorResult.message)} (ssoUid: ${buyer.userId}, fairCode: ${buyer.fairCode}, fiscalYear: ${buyer.fiscalYear})`,
                status: EmailStatus.NO_NEED_TO_SEND,
              })

              return {
                status: HttpStatus.BAD_REQUEST,
                message: `recommendExhibitorResult not found (ssoUid: ${buyer.userId}, fairCode: ${buyer.fairCode}, fiscalYear: ${buyer.fiscalYear})`
              }
            } else {
              const exhibitorCardArray: any[] = [];
              recommendExhibitorResult?.data?.data?.hits.forEach((exhibitorData: any) => {
                exhibitorCardArray.push({
                  companyLogo: exhibitorData?.supplierLogo,
                  exhibitorName: exhibitorData?.exhibitorName,
                  locationEn: exhibitorData?.countryDescEn,
                  locationTc: exhibitorData?.countryDescZhHans,
                  locationSc: exhibitorData?.countryDescZhHant,
                  exhibitorType: exhibitorData?.exhibitorType,
                  booth: exhibitorData?.boothNumbers,
                  zone: exhibitorData?.exhibitorZones,
                  pavilions: exhibitorData?.exhibitorPavilions,
                  virtualBoothType: exhibitorData?.virtualBoothType,
                  supplierVerifiedLabel: exhibitorData?.supplierVerifiedLabel,
                  productImageUrl: exhibitorData?.latestProducts
                });
              });
        
              return this.c2mService.handleNotificationForKickOff({
                templateId: NotificationTemplatesId.C2M_KICK_OFF_BUYER,
                notificationType: reminderNotiType,
                receiverRole: ReceiverRole.BUYER,
                userData: buyer,
                currFair,
                messageBodyTemplate,
                recommendExhibitors: exhibitorCardArray,
              });
            }
          })
          .catch(error => {
            return {
              status: HttpStatus.BAD_REQUEST,
              message: `call AI API fail. error message: ${error}`
            }
          })
        )
      })
      return Promise.all(returnResult)
    })
    .catch((err: any) => {
      this.logger.log(JSON.stringify({ action: 'catch error', section: 'Notification - handleKickOffBuyerReminder', step: 'error', detail: `${err ?? JSON.stringify(err)}` }));
      return {
        status: HttpStatus.BAD_REQUEST,
        message: err ?? JSON.stringify(err),
      };
    });
  }

  /*
  C2M Daily Meeting Reminder

  Internval : Every Min

  Send reminder to user who has meeting today
  Supported Combined Fair
  */
  public async handleDailyMeetingReminder(currFair: Record<string, any>): Promise<any> {
    let debugRequesterSsoUidSQL = '';
    let debugResponderSsoUidSQL = '';
    if (this.isDebug) {
      debugRequesterSsoUidSQL = ` AND requesterSsoUid in (${currFair.testingAccountUserId})  `;
      debugResponderSsoUidSQL = ` AND responderSsoUid in (${currFair.testingAccountUserId})  `;
    }

   // get HK UTC Date Range
    const currentDateHKT = moment().tz('Asia/Hong_Kong').format('YYYY-MM-DD');
    const currentTimeHKTStart = currentDateHKT + '00:00:00';
    const currentTimeHKTEnd = currentDateHKT + '23:59:59';

    const todayStart = moment.tz(currentTimeHKTStart, 'YYYY-MM-DD HH:mm:ss', 'Asia/Hong_Kong').utc().format('YYYY-MM-DD HH:mm:ss');
    const todayEnd = moment.tz(currentTimeHKTEnd, 'YYYY-MM-DD HH:mm:ss', 'Asia/Hong_Kong').utc().format('YYYY-MM-DD HH:mm:ss');

    // get user of daily summary that not sent yet
    let query = `
        select daily.*  from 
        (
              SELECT 
                requesterSsoUid as userId,
                fiscalYear as fiscalYear
              FROM 
                vep_c2m_service_db.vepC2MMeeting  
              WHERE 
                status = ${MeetingStatus.ACCEPTED} 
                AND startTime >= '${todayStart}'
                AND startTime <= '${todayEnd}' 
                AND creationTime <= '${todayStart}'
                AND fairCode in (${currFair.fairCodeSQL})
                AND fiscalYear in (${currFair.fiscalYearSQL})
                ${debugRequesterSsoUidSQL}
              group by requesterSsoUid 
          UNION
              SELECT  
                responderSsoUid as userId,
                responderFiscalYear as fiscalYear
              FROM 
                vep_c2m_service_db.vepC2MMeeting  
              WHERE 
                status = ${MeetingStatus.ACCEPTED}
                AND startTime >= '${todayStart}'
                AND startTime <= '${todayEnd}'
                AND creationTime <= '${todayStart}'
                AND responderFairCode in (${currFair.fairCodeSQL})
                AND responderFiscalYear in (${currFair.fiscalYearSQL})  
                ${debugResponderSsoUidSQL}                
              group by responderSsoUid
        ) daily
          LEFT JOIN vep_c2m_service_db.vepC2MNotification noti 
          ON ( noti.refUserId = daily.userId 
            AND noti.refFairCode = '${currFair.fairCodeString}' 
            AND noti.refFiscalYear = '${currFair.fiscalYearString}'  
            AND noti.notificationType = '${NotificationType.DAILY_MEETING_SUMMARY}_${currentDateHKT}'  
            )
        WHERE noti.id is null
        LIMIT ${this.scheduleJobLimitDaily}
    `;

    console.log(query);
    this.logger.log(JSON.stringify({ action: 'query', section: 'Notification - handleDailyMeetingReminder', step: '1', detail: `query: ${query}` }));

    return getConnection().query(query)
    .then((allUsers: any) => {
      if (allUsers.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target fair', section: 'Notification - handleDailyMeetingReminder', step: 'error', detail: `no notification need to send (no target buyer found fairCode: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})` }));
        return Promise.reject({
          status: 400,
          message: `no notification need to send (no target exhibitors found fairCode: ${currFair.fairCodeSQL}, fiscalYear: ${currFair.fiscalYearSQL})`
        });
      }

      return Promise.all([allUsers, this.notificationAPIService.getMessageBodyForSns({ templateId: NotificationTemplatesId.DAILY_MEETING_SUMMARY, templateSource: templateSource.DIRECT })])
    })
    .then(([allUsers, messageBodyTemplate]) => {
      if (messageBodyTemplate.status === 400 && !messageBodyTemplate.data) {
        this.logger.log(JSON.stringify({ action: 'getMessageBodyForSns', section: `Notification - handleDailyMeetingReminder`, step: 'error', detail: `Request failed ${NotificationTemplatesId.DAILY_MEETING_SUMMARY} ${currFair.fairCodeSQL}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}` }));
        return Promise.reject(`Request failed ${NotificationTemplatesId.DAILY_MEETING_SUMMARY} ${currFair.fairCodeSQL}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}`);
      }

      const returnResult: Promise<any>[] = [];
      allUsers.forEach((user: any) => {
        returnResult.push(
          this.c2mService.handleNotificationForSummary({
            userData: user,
            currFair,
            summaryDate: currentDateHKT,
            messageBodyTemplate,
          })
        )
      });
      return Promise.all(returnResult);
    })
    .catch((error: any) => {
      this.logger.log(JSON.stringify({ action: 'catch error', section: 'Notification - handleDailyMeetingReminder', step: 'error', detail: `${JSON.stringify(error)}` }));
      return {
        status: HttpStatus.BAD_REQUEST,
        message: error ?? JSON.stringify(error),
      };
    });
  }
  // ------------------------------------------------ End of R2A Summary Notification ------------------------------------------------ //


  // ------------------------------------------------ R2B Seminar Summary Notification ------------------------------------------------ //
  public async seminarSummaryNoti(action : string): Promise<any> {
    // 1. Get an array of fairCode + fairYear which are between C2M period
    return this.getFairDataSeparately()
    .then(activeFairList => {
      if (activeFairList.status !== 200) {
        this.logger.log(JSON.stringify({ action: 'get fair data separately', section: 'Notification - seminarSummaryNoti', step: 'error', detail: `cannot get the fair data in ${action}. Return value from getFairDataSeparately(): ${JSON.stringify(activeFairList)}` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot get the fair data in ${action}. Return value from getFairDataSeparately(): ${JSON.stringify(activeFairList)}`
        })
      }

      const fairInC2MPeriodList: Record<string, any>[] = [];

      // set current time - UTC
      const currentTime = moment().utc();
      activeFairList?.data?.length && activeFairList?.data.forEach((fair: any) => {
        // set fair start time - UTC & set fair end time - UTC
        const fairStartTime = moment.tz(fair.c2mStartDatetime, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong').utc();
        const fairEndTime = moment.tz(fair.c2mEndDatetime, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong').utc();
        let isBetweenC2MPeriod: boolean = currentTime.isBetween(fairStartTime, fairEndTime);

        if (isBetweenC2MPeriod) {
          fairInC2MPeriodList.push({
            fairCode: fair.fairData[0].fairCode,
            fiscalYear: fair.fairData[0].fiscalYear
          });
        }
      });

      return Promise.all(fairInC2MPeriodList);
    })
    .then(async (resultList: any) => {
      if (!resultList.length) {
        this.logger.log(JSON.stringify({ action: 'get fair list which is between C2M period', section: 'Notification - seminarSummaryNoti', step: 'error', detail: `no fairs are between C2M period in ${action}` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `no fairs are between C2M period in ${action}`
        })
      }

      const finalResult: Promise<any>[] = [];
      switch (action) {
        case 'seminarSummaryReminder':
          // handle config value - sending time
          let seminarSummarySendingTimeHKT: moment.Moment;
          let seminarSummarySendingTimeAdd15MinsHKT: moment.Moment;

          const seminarSummarySendingTimeConfigResult = await this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_SEMINAR_SEMINAR_SUMMARY_REMINDER_TIME.id });
          const seminarSummarySendingTimeConfig = seminarSummarySendingTimeConfigResult?.data?.configValue;

          if (seminarSummarySendingTimeConfigResult.status !== 200 || !seminarSummarySendingTimeConfigResult) {
            this.logger.log(JSON.stringify({ action: 'get config value (sending time)', section: 'Notification - seminarSummaryNoti', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_SEMINAR_SEMINAR_SUMMARY_REMINDER_TIME.id} config value` }));
            return Promise.reject({
              status: constant.COMMON_CONSTANT.FAIL,
              message: `cannot get the ${CONFIG.NOTIFICATION_SEMINAR_SEMINAR_SUMMARY_REMINDER_TIME.id} config value`
            })
          }
          
          // seminarSummarySendingTimeHKT = moment.tz(seminarSummarySendingTimeConfig, 'HH:mm', 'Asia/Hong_Kong');
          const currentDateHKT = moment().tz('Asia/Hong_Kong').format('YYYY-MM-DD');
          let buyerKickOffSendingTimeHKTString = currentDateHKT + 'T' + seminarSummarySendingTimeConfig + ':00'
          seminarSummarySendingTimeHKT  = moment.tz(buyerKickOffSendingTimeHKTString, 'Asia/Hong_Kong');
          seminarSummarySendingTimeAdd15MinsHKT = moment.tz(buyerKickOffSendingTimeHKTString, 'Asia/Hong_Kong').add(120, 'minutes');
        


          // set current time - HKT
          const currentTimeHKT = moment().tz('Asia/Hong_Kong');
          let isBetweenSendingPeriod: boolean = currentTimeHKT.isBetween(seminarSummarySendingTimeHKT, seminarSummarySendingTimeAdd15MinsHKT);
          console.log(`when current time (${currentTimeHKT}) is between ${seminarSummarySendingTimeHKT} and ${seminarSummarySendingTimeAdd15MinsHKT}, then send noti`);

          if (isBetweenSendingPeriod) {
            finalResult.push(this.handleSeminarSummaryReminder(resultList, action));
          }
        break;

        case 'attendingSeminarReminder':
          finalResult.push(this.handleSeminarSummaryReminder(resultList, action));
        break;

        default:
          this.logger.log(JSON.stringify({ action: 'distinguish which template is going to handle', section: 'Notification - seminarSummaryNoti', step: 'error', detail: `cannot define this action (${action})` }));
          return Promise.reject({
            status: constant.COMMON_CONSTANT.FAIL,
            message: `cannot define this action (${action})`
          })
        break;
      }

      return Promise.all(finalResult);
    })
    .catch((error: any) => {
      this.logger.log(JSON.stringify({ action: 'seminarSummaryNoti - error', section: 'Notification - seminarSummaryNoti', step: 'catch error', detail: `${JSON.stringify(error)}` }));
      return {
        status: error?.status ?? 400,
        message: error?.message ?? JSON.stringify(error)
      };
    });
  }

  /*
  Summary Reminder - Seminar

  Internval : Every Min

  Case 1. Send reminder to user N Day before seminar start day.

  Case 2. Send reminder to user before x mins of the seminar start time.
  */
  public async handleSeminarSummaryReminder(activeFairArray: Record<string, any>[], action: string): Promise<any> {
    // 1. Get configuration value range for filter out seminars later  - HKT & Moment

    // start range for SEMINAR_SUMMARY_REMINDER : today 00:00 HKT
    // start range for SEMINAR_ATTENDING_REMINDER : now HKT
    let seminarSummaryStartRange: moment.Moment;

    // end range for SEMINAR_SUMMARY_REMINDER : today + config day 23:59 HKT
    // end range for SEMINAR_ATTENDING_REMINDER : now HKT + config mins
    let seminarSummaryEndRange: moment.Moment = moment();

    let reminderNotiType = '';
    let templateId: NotificationTemplatesId;

    switch (action) {
      case 'seminarSummaryReminder':
        seminarSummaryStartRange = moment().tz('Asia/Hong_Kong').startOf('day');
        const seminarSummaryNoOfDayBeforeStartDayConfigResult = await this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_SEMINAR_SEMINAR_SUMMARY_REMINDER_DAY.id })
        if (seminarSummaryNoOfDayBeforeStartDayConfigResult.status !== 200 || !seminarSummaryNoOfDayBeforeStartDayConfigResult.data) {
          this.logger.log(JSON.stringify({ action: 'get config value', section: `Notification - handleSeminarSummaryReminder_${action}`, step: 'error', detail: `Cannot get the ${CONFIG.NOTIFICATION_SEMINAR_SEMINAR_SUMMARY_REMINDER_DAY.id} config value` }));
          return Promise.reject({
            status: constant.COMMON_CONSTANT.FAIL,
            message: `cannot get the ${CONFIG.NOTIFICATION_SEMINAR_SEMINAR_SUMMARY_REMINDER_DAY.id} config value`
          })
        }
        const seminarSummaryNoOfDayBeforeStartDayConfig = seminarSummaryNoOfDayBeforeStartDayConfigResult?.data?.configValue;
        const seminarSummaryNoOfDayBeforeStartDay = Number(seminarSummaryNoOfDayBeforeStartDayConfig);
        seminarSummaryEndRange = moment().tz('Asia/Hong_Kong').endOf('day').add(seminarSummaryNoOfDayBeforeStartDay, 'd');

        // console.log(`sending range: ${seminarSummaryStartRange} - ${seminarSummaryEndRange}`);
        // reminderNotiType = NotificationType.SEMINAR_SUMMARY_REMINDER + ', ' +  seminarSummaryStartRange.format('YYYY-MM-DD HH:mm') + ', ' +  seminarSummaryEndRange.format('YYYY-MM-DD HH:mm');
        reminderNotiType = NotificationType.SEMINAR_SUMMARY_REMINDER + '_' +  moment().tz('Asia/Hong_Kong').format('YYYY_MM_DD');
        templateId = NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER
      break;

      case 'attendingSeminarReminder':
        seminarSummaryStartRange = moment().tz('Asia/Hong_Kong');
        const upComingBeforeMinConfigResult = await this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_SEMINAR_ATTENDING_SEMINAR_REMINDER_MINUTE.id });
        if (upComingBeforeMinConfigResult.status !== 200 || !upComingBeforeMinConfigResult.data) {
          this.logger.log(JSON.stringify({ action: 'get config value', section: `Notification - handleSeminarSummaryReminder_${action}`, step: 'error', detail: `Cannot get the ${CONFIG.NOTIFICATION_SEMINAR_ATTENDING_SEMINAR_REMINDER_MINUTE.id} config value` }));
          return Promise.reject({
            status: constant.COMMON_CONSTANT.FAIL,
            message: `cannot get the ${CONFIG.NOTIFICATION_SEMINAR_ATTENDING_SEMINAR_REMINDER_MINUTE.id} config value`
          })
        }
        const upComingBeforeMinConfig = upComingBeforeMinConfigResult?.data?.configValue;
        const upComingBeforeMin = Number(upComingBeforeMinConfig);
        seminarSummaryEndRange = moment().tz('Asia/Hong_Kong').add(upComingBeforeMin, 'minutes');

        // console.log(`sending range: ${seminarSummaryStartRange} - ${seminarSummaryEndRange}`);
        reminderNotiType = NotificationType.SEMINAR_ATTENDING_REMINDER + ', ' + seminarSummaryStartRange.format('YYYY-MM-DD HH:mm') + ', ' +  seminarSummaryEndRange.format('YYYY-MM-DD HH:mm');
        templateId = NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER
      break;

      default:
        this.logger.log(JSON.stringify({ action: 'distinguish which template is going to handle', section: `Notification - handleSeminarSummaryReminder_${action}`, step: 'error', detail: `cannot define this action (${action})` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot define this action (${action})`
        })
    }

    this.logger.log(JSON.stringify({ action: 'get configuration value range for filter out seminars', section: `Notification - handleSeminarSummaryReminder_${action}`, step: '1', detail: `sending range: ${seminarSummaryStartRange} - ${seminarSummaryEndRange}` }))

    // 3. Get the corresponding 'vms_project_no' and 'vms_project_year' for the target fairs (Since SBE API need 'vms_project_no' and 'vms_project_year' inputs)
    let whereConditions = '';
    for (let i = 0; i < activeFairArray.length; i++) {
      if (i === 0) {
        whereConditions += ` (fairCode = '${activeFairArray[i].fairCode}' AND fiscal_year = '${activeFairArray[i].fiscalYear}') `;
      } else {
        whereConditions += ` OR (fairCode = '${activeFairArray[i].fairCode}' AND fiscal_year = '${activeFairArray[i].fiscalYear}') `;
      }
    }

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
          AND ${whereConditions}
      ) filterList
      group by faircode, fiscal_year 
    `;
    console.log(queryForVmsInfo);

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');

    return connection.query(queryForVmsInfo, undefined, slaveRunner)
    .then(async (targetVmsInfo: any) => {
      if (targetVmsInfo.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get target vms info', section: `Notification - handleSeminarSummaryReminder_${action}`, step: 'error', detail: `No notification need to send. The targetFairs result (${JSON.stringify(targetVmsInfo)}) is empty` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `No notification need to send. The targetVmsInfo result (${JSON.stringify(targetVmsInfo)}) is empty`
        })
      }
      this.logger.log(JSON.stringify({ action: 'get the corresponding vms_project_no and vms_project_year for the target fairs', section: `Notification - handleSeminarSummaryReminder_${action}`, step: '3', detail: `Taget vms info that are going to send noti: ${JSON.stringify(targetVmsInfo)}` }));
      
      // 4. Call SBE API 3 times for 3 languages (number of calling SBE API: no. of fairCode x 3)
      const allSeminarsEnPromise: Promise<any>[] = [];
      const allSeminarsTcPromise: Promise<any>[] = [];
      const allSeminarsScPromise: Promise<any>[] = [];

      targetVmsInfo.forEach((vms: any) => {
        allSeminarsEnPromise.push(
          this.apiFairService
            .findAllSeminars(vms.vms_project_no, vms.vms_project_year, 'VEP', 'en')
            .catch((error: any) => {
              this.logger.log(JSON.stringify({
                action: 'call SBE API',
                section: `Notification - handleSeminarSummaryReminder_${action}`,
                step: 'error',
                detail: {
                  vmsProjectNo: vms.vms_project_no,
                  vmsProjectYear: vms.vms_project_year,
                  lenguage: 'en',
                  status: error?.status ?? 400,
                  message: error?.message ?? JSON.stringify(error)
                }
              }));
              return {
                status: error?.status ?? 400,
                message: error?.message ?? JSON.stringify(error)
              };
            })
        );
      });

      targetVmsInfo.forEach((vms: any) => {
        allSeminarsTcPromise.push(
          this.apiFairService
            .findAllSeminars(vms.vms_project_no, vms.vms_project_year, 'VEP', 'zh')
            .catch((error: any) => {
              this.logger.log(JSON.stringify({
                action: 'call SBE API',
                section: `Notification - handleSeminarSummaryReminder_${action}`,
                step: 'error',
                detail: {
                  vmsProjectNo: vms.vms_project_no,
                  vmsProjectYear: vms.vms_project_year,
                  lenguage: 'zh',
                  status: error?.status ?? 400,
                  message: error?.message ?? JSON.stringify(error)
                }
              }));
              return {
                status: error?.status ?? 400,
                message: error?.message ?? JSON.stringify(error)
              };
            })
        );
      });

      targetVmsInfo.forEach((vms: any) => {
        allSeminarsScPromise.push(
          this.apiFairService
            .findAllSeminars(vms.vms_project_no, vms.vms_project_year, 'VEP', 'cn')
            .catch((error: any) => {
              this.logger.log(JSON.stringify({
                action: 'call SBE API',
                section: `Notification - handleSeminarSummaryReminder_${action}`,
                step: 'error',
                detail: {
                  vmsProjectNo: vms.vms_project_no,
                  vmsProjectYear: vms.vms_project_year,
                  lenguage: 'cn',
                  status: error?.status ?? 400,
                  message: error?.message ?? JSON.stringify(error)
                }
              }));
              return {
                status: error?.status ?? 400,
                message: error?.message ?? JSON.stringify(error)
              };
            })
        );
      });

      const allSeminarsEn: any = await Promise.all(allSeminarsEnPromise);
      const allSeminarsTc: any = await Promise.all(allSeminarsTcPromise);
      const allSeminarsSc: any = await Promise.all(allSeminarsScPromise);
      // console.log(allSeminarsEn, allSeminarsTc, allSeminarsSc);
      

      return Promise.all([allSeminarsEn, allSeminarsTc, allSeminarsSc]);
    })
    .then(([allSeminarsEn, allSeminarsTc, allSeminarsSc]) => {
      if (allSeminarsEn.length === 0 || allSeminarsTc.length === 0 || allSeminarsSc.length === 0) {
        this.logger.log(JSON.stringify({ action: 'get SBE seminars data', section: `Notification - handleSeminarSummaryReminder_${action}`, step: 'error', detail: `No SBE seminars data.` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `No SBE seminars data.`
        })
      }
      this.logger.log(JSON.stringify({ 
        action: 'get SBE seminars data',
        section: `Notification - handleSeminarSummaryReminder_${action}`,
        step: '4',
        detail: `All SBE seminars data: ${allSeminarsEn} && ${allSeminarsTc} && ${allSeminarsSc}}` 
      }));
      
      
      // filter all status 400 return result from this.apiFairService.findAllSeminars()
      let successSeminarsEn: any[];
      successSeminarsEn = allSeminarsEn.filter((seminar: any) => {
        return seminar.status === 200;
      });

      let successSeminarsTc;
      successSeminarsTc = allSeminarsTc.filter((seminar: any) => {
        return seminar.status === 200;
      });

      let successSeminarsSc;
      successSeminarsSc = allSeminarsSc.filter((seminar: any) => {
        return seminar.status === 200;
      });

      // successSeminarsEn.forEach((seminarEN: any) => {
      //   console.log('successSeminarsEn', seminarEN.data.data[0].eventId)
      // })
      // successSeminarsTc.forEach((seminarTC: any) => {
      //   console.log('successSeminarsTc', seminarTC.data.data[0].eventId)
      // })
      // successSeminarsSc.forEach((seminarSC: any) => {
      //   console.log('successSeminarsSc', seminarSC.data.data[0].eventId)
      // })

      // console.log(`${successSeminarsEn}, ${successSeminarsTc}, ${successSeminarsSc} include all successSeminars arrays`);
      this.logger.log(JSON.stringify({ 
        action: 'get status 200 SBE seminars data', 
        section: `Notification - handleSeminarSummaryReminder_${action}`, 
        step: '5', 
        detail: `Filterd SBE seminars data (status 200): ${successSeminarsEn} && ${successSeminarsTc} && ${successSeminarsSc}}` }));
  
      // 5. filter all seminars which are from seminarSummaryStartRange to seminarSummaryEndRange
      let seminarsFilteredList: any[] = [];
      let seminarsFilteredTempList;
      successSeminarsEn.forEach((eventList: any) => {
        seminarsFilteredTempList = eventList?.data?.data.filter((seminar: any) => {
          const seminarStartTime = moment.tz(seminar.startAt, 'YYYY-MM-DD HH:mm:ss', 'Asia/Hong_Kong');
          return seminarStartTime >= seminarSummaryStartRange && seminarStartTime <= seminarSummaryEndRange;
        });
        if (seminarsFilteredTempList.length !== 0) {
          seminarsFilteredList.push(seminarsFilteredTempList);
        }
      });

      return Promise.all([seminarsFilteredList, successSeminarsEn, successSeminarsTc, successSeminarsSc]);
    })
    .then(async ([seminarsFilteredList, successSeminarsEn, successSeminarsTc, successSeminarsSc]: any[]) => {
      if (seminarsFilteredList.length === 0) {
        this.logger.log(JSON.stringify({ action: `get SBE seminars data which are from ${seminarSummaryStartRange} to ${seminarSummaryEndRange}`, section: `Notification - handleSeminarSummaryReminder_${action}`, step: 'error', detail: `No seminars will be held between ${seminarSummaryStartRange} and ${seminarSummaryEndRange}. The result (${JSON.stringify(seminarsFilteredList)}) is empty` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `No seminars will be held between ${seminarSummaryStartRange} and ${seminarSummaryEndRange}. The result (${JSON.stringify(seminarsFilteredList)}) is empty`
        })
      }
      this.logger.log(JSON.stringify({ action: `get SBE seminars data which are from ${seminarSummaryStartRange} to ${seminarSummaryEndRange}`, section: `Notification - handleSeminarSummaryReminder_${action}`, step: '6', detail: `Target SBE seminars data: ${JSON.stringify(seminarsFilteredList)}` }));

      // 6. Pass the eventId and seminarId of these filtered seminars to the vepFairSeminarRegistration to find the target seminars
      let whereConditionsForEvent = '';
      for (let i = 0; i < seminarsFilteredList.length; i++) {
        console.log(seminarsFilteredList[i].length);
        for (let j = 0; j < seminarsFilteredList[i].length; j++) {
          if (i === 0 && j === 0) {
            whereConditionsForEvent += ` (eventId = '${seminarsFilteredList[i][0].eventId}' AND seminarId = '${seminarsFilteredList[i][j].id}') `;
          } else {
            whereConditionsForEvent += ` OR (eventId = '${seminarsFilteredList[i][0].eventId}' AND seminarId = '${seminarsFilteredList[i][j].id}') `;
          }
        }
      }

      let whereConditionsForJoinNotiTable = ''
      if (action === 'seminarSummaryReminder') {
        whereConditionsForJoinNotiTable =  `AND noti.templateId = ${NotificationTemplatesId.SEMINAR_SUMMARY_REMINDER} AND notificationType = '${reminderNotiType}'`
      }

      if (action === 'attendingSeminarReminder') {
        whereConditionsForJoinNotiTable =  `AND noti.templateId = ${NotificationTemplatesId.SEMINAR_ATTENDING_REMINDER} AND noti.meetingId = seminarSummary.seminarId`
      }

      // 7. Get the target users list with user
      let queryForTagetUsers = `
        SELECT 
          userId,
          fairCode,
          fiscalYear,
          eventId,
          seminarId,
          userRole
        FROM 
          vepFairDb.vepFairSeminarRegistration seminarSummary
        LEFT JOIN vepFairDb.vepC2MNotification noti
          ON ( noti.refUserId = seminarSummary.userId
            AND noti.refFairCode = seminarSummary.fairCode 
            AND noti.refFiscalYear = seminarSummary.fiscalYear
            ${whereConditionsForJoinNotiTable}
          )
        WHERE 
          (${whereConditionsForEvent})
            AND noti.id is null
            GROUP BY userId, fairCode, fiscalYear
        LIMIT 5
      `;

      console.log(queryForTagetUsers);
      const targetUsers = await getConnection('buyerDatabaseForWrite').query(queryForTagetUsers);

      return Promise.all([targetUsers, successSeminarsEn, successSeminarsTc, successSeminarsSc, whereConditionsForEvent]);
    })
    .then(([targetUsers, successSeminarsEn, successSeminarsTc, successSeminarsSc, whereConditionsForEvent]: any[] | any) => {
      // 8. Loop the targetUsers list and allSeminars to map the data noti need
      if (!targetUsers.length) {
        this.logger.log(JSON.stringify({ action: 'get target users for sending noti', section: `Notification - handleSeminarSummaryReminder_${action}`, step: 'error', detail: `target users after query (${targetUsers} are empty)` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `target users after query (${targetUsers} are empty)`
        })
      }

      this.logger.log(JSON.stringify({ action: 'get target users for sending noti', section: `Notification - handleSeminarSummaryReminder_${action}`, step: '7', detail: `target users after query (${targetUsers ?? JSON.stringify(targetUsers)} are empty)` }));
      return Promise.all([targetUsers, successSeminarsEn, successSeminarsTc, successSeminarsSc, whereConditionsForEvent, this.notificationAPIService.getMessageBodyForSns({ templateId, templateSource: templateSource.DIRECT })])
    })
    .then(async ([targetUsers, successSeminarsEn, successSeminarsTc, successSeminarsSc, whereConditionsForEvent, messageBodyTemplate]) => {
      if (messageBodyTemplate.status === 400 && !messageBodyTemplate.data) {
        this.logger.log(JSON.stringify({ action: 'getMessageBodyForSns', section: `Notification - handleNotificationForSeminarSummary_${reminderNotiType}`, step: 'error', detail: `Request failed ${templateId} ${targetUsers[0]?.fairCode}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}` }));
        return {
          status: messageBodyTemplate.status ?? constant.COMMON_CONSTANT.FAIL,
          message: `Request failed ${templateId} ${targetUsers[0]?.fairCode}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}`
        };
      }

      let resultArray: Promise<any>[] = [];
      // 10. Send notification by user
        targetUsers.forEach((user: any) => {
          resultArray.push(this.c2mService.handleNotificationForSeminarSummary({
            templateId,
            notificationType: reminderNotiType,
            userData: user,
            successSeminarsEn, 
            successSeminarsTc, 
            successSeminarsSc,
            whereConditionsForEvent,
            seminarSummaryStartRange,
            seminarSummaryEndRange,
            messageBodyTemplate
          }));
        });

        return Promise.all(resultArray);
    })
    .catch((error: any) => {
      this.logger.log(JSON.stringify({ action: `handleSeminarSummaryReminder_${action} - error`, section: `Notification - handleSeminarSummaryReminder_${action}`, step: 'catch error', detail: `${JSON.stringify(error)}` }));
      return {
        status: error?.status ?? 400,
        message: error?.message ?? JSON.stringify(error)
      }
    })
    .finally(() => {
      slaveRunner.release();
    });
  }
  // ------------------------------------------------ End of R2B Seminar Summary Notification ------------------------------------------------ //


  // ------------------------------------------------ R2B BM List Notification ------------------------------------------------ //
  /*
  No response is received

  Internval : Every Min

  Send reminder to user when buyer has no response to recommended list (when all interested 1 Status === 0 && all interested 2 Status === 0)
  */
  public async noResponseInBmList(currFair: Record<string, any>): Promise<any> {
    const reminderNotiType = NotificationType.NO_RESPONSE_REMINDER + '_' +  moment.tz('Asia/Hong_Kong').format('YYYY_MM_DD');

    // setup current time - UTC
    const currentTime = moment().utc();
    // setup current time - HKT
    const currentTimeHKT = moment().tz('Asia/Hong_Kong');
    // setup current date - HKT (i.e. set HH:MM:SS to 00:00:00 - HKT)
    const currentDateHKT = moment().tz('Asia/Hong_Kong').startOf('day');

    // handle config value - No. of days before C2M end day
    let fairEndDayBefore: moment.Moment;
    // handle config value - Interval (day) of checking
    let noResponseInterval: number;
    // handle config value - Maximum number of receive no response
    let noResponseMax: number;
    // handle config value - Time of sending
    let noResponseSendingTimeHKT: moment.Moment;

    return this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_DAY_1.id })
    .then((noResponseNoOfDayBeforeEndDayConfigResult: any) => {
      if (noResponseNoOfDayBeforeEndDayConfigResult.status !== 200 || !noResponseNoOfDayBeforeEndDayConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (no. of days before C2M end day)', section: 'Notification - noResponseInBmList', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_DAY_1.id} config value` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_DAY_1.id} config value`
        })
      }
      const noResponseNoOfDayBeforeEndDayConfig = noResponseNoOfDayBeforeEndDayConfigResult?.data?.configValue;
      const noResponseNoOfDayBeforeEndDay = Number(noResponseNoOfDayBeforeEndDayConfig);
      fairEndDayBefore = moment.tz(currFair.c2mEndDatetime, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong').subtract(noResponseNoOfDayBeforeEndDay, 'd').utc();

      this.logger.log(JSON.stringify({ action: 'get config value (no. of days before C2M end day)', section: 'Notification - noResponseInBmList', step: '1', detail: `only send the noti before C2M end day ${noResponseNoOfDayBeforeEndDay} day` }));
      return Promise.all([fairEndDayBefore, this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_DAY_2.id })]);
    })
    .then(([fairEndDayBefore, noResponseIntervalConfigResult]: any) => {
      if (noResponseIntervalConfigResult.status !== 200 || !noResponseIntervalConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (interval of day)', section: 'Notification - noResponseInBmList', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_DAY_2.id} config value` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_DAY_2.id} config value`
        })
      }

      const noResponseIntervalConfig = noResponseIntervalConfigResult?.data?.configValue;
      noResponseInterval = Number(noResponseIntervalConfig);

      this.logger.log(JSON.stringify({ action: 'get config value (interval of day)', section: 'Notification - noResponseInBmList', step: '2', detail: `every ${noResponseInterval} day check the noResponse noti need to send or not` }));
      return Promise.all([fairEndDayBefore, noResponseInterval, this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_NUMBER.id })]);
    })
    .then(([fairEndDayBefore, noResponseInterval, noResponseMaxConfigResult]: any) => {
      if (noResponseMaxConfigResult.status !== 200 || !noResponseMaxConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (max number of receiving no response noti)', section: 'Notification - noResponseInBmList', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_NUMBER.id} config value` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_NUMBER.id} config value`
        })
      }

      const noResponseMaxConfig = noResponseMaxConfigResult?.data?.configValue;
      noResponseMax = Number(noResponseMaxConfig);

      this.logger.log(JSON.stringify({ action: 'get config value (max number of receiving no response noti)', section: 'Notification - noResponseInBmList', step: '3', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_NUMBER.id} config value` }));
      return Promise.all([fairEndDayBefore, noResponseInterval, noResponseMax, this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_TIME.id })]);
    })
    .then(([fairEndDayBefore, noResponseInterval, noResponseMax, noResponseSendingTimeConfigResult]: any) => {
      if (noResponseSendingTimeConfigResult.status !== 200 || !noResponseSendingTimeConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (sending time)', section: 'Notification - noResponseInBmList', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_TIME.id} config value` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_TIME.id} config value`
        })
      }

      // handle config value - Time of sending + 15mins
      // let noResponseSendingTimeAdd15MinsHKT: moment.Moment;

      // noResponseSendingTimeAdd15MinsHKT = moment.tz(noResponseSendingTimeConfig, 'HH:mm', 'Asia/Hong_Kong').add(60, 'minutes');
      // let isBetweenSendingPeriod: boolean = currentTimeHKT.isBetween(noResponseSendingTimeHKT, noResponseSendingTimeAdd15MinsHKT);

      const noResponseSendingTimeConfig = noResponseSendingTimeConfigResult?.data?.configValue;
      // noResponseSendingTimeHKT = moment.tz(noResponseSendingTimeConfig, 'HH:mm', 'Asia/Hong_Kong');
      let currentDateHKTForSending = moment().tz('Asia/Hong_Kong').format("YYYY-MM-DD");
      let noResponseSendingTimeHKTString = currentDateHKTForSending + 'T' + noResponseSendingTimeConfig + ':00'
      noResponseSendingTimeHKT  = moment.tz(noResponseSendingTimeHKTString, 'Asia/Hong_Kong');

      let currentDayEndTimeHKT: moment.Moment = moment().tz('Asia/Hong_Kong').endOf('day')
      let isBetweenSendingPeriod = currentTimeHKT.isBetween(noResponseSendingTimeHKT, currentDayEndTimeHKT);

      console.log(`when current time (${currentTimeHKT}) is between ${noResponseSendingTimeHKT} and ${currentDayEndTimeHKT}, then send noti`);
  
      this.logger.log(JSON.stringify({ action: 'get config value (sending time)', section: 'Notification - noResponseInBmList', step: '4', detail: `when current time (${currentTimeHKT}) is between ${noResponseSendingTimeHKT} and ${currentDayEndTimeHKT}, then send noti` }));
      return Promise.all([fairEndDayBefore, noResponseInterval, noResponseMax, isBetweenSendingPeriod]);
    })
    .then(([fairEndDayBefore, noResponseInterval, noResponseMax, isBetweenSendingPeriod]: any) => {
      // let query = `
      //   SELECT 
      //     buyer.id,
      //     listItems.recommendationId,
      //     buyer.ssoUid,
      //     buyer.fairCode,
      //     buyer.fairYear,
      //     buyer.sentTime,
      //     buyer.bmMessage,
      //     buyer.lastUpdatedBy,
      //     COUNT(*) AS noOfExhibitorsInBmList,
      //     COUNT(CASE WHEN listItems.interestedStatus = 0 then 1 ELSE NULL END) AS totalInterest0Status,
      //     COUNT(CASE WHEN listItems.interestedStatus = 1 then 1 ELSE NULL END) AS totalInterest1Status,
      //     COUNT(CASE WHEN listItems.interestedStatus = 2 then 1 ELSE NULL END) AS totalInterest2Status
      //   FROM 
      //     vep_c2m_service_db.vepC2MBMRecommendation buyer 
      //   INNER JOIN vep_c2m_service_db.vepC2MBMRecommendationItem listItems ON listItems.recommendationId = buyer.id 
      //   LEFT JOIN vep_c2m_service_db.vepC2MNotification noti 
      //     ON ( noti.refUserId = buyer.ssoUid 
      //     AND noti.refFairCode = buyer.fairCode
      //     AND noti.refFiscalYear = buyer.fairYear
      //     AND noti.notificationType = '${reminderNotiType}'
      //     )
      //   WHERE sentTime IN (SELECT MAX(sentTime) FROM vep_c2m_service_db.vepC2MBMRecommendation WHERE publishType = 'external' GROUP BY ssoUid, fairCode, fairYear)
      //   AND buyer.fairCode in (${currFair.fairCodeSQL})
      //   AND buyer.fairYear in (${currFair.fiscalYearSQL})  
      //   AND noti.id is null  
      //   GROUP BY listItems.recommendationId
      //   HAVING totalInterest1Status = 0 AND totalInterest2Status = 0
      //   LIMIT ${this.scheduleJobLimitNoResponseInBmList}
      // `;
      let query = `
      SELECT noResponseReminder.*, COUNT(*) as sentNotiNum from
      (
        SELECT 
          buyer.id,
          listItems.recommendationId,
          buyer.ssoUid,
          buyer.fairCode,
          buyer.fairYear,
          buyer.sentTime,
          buyer.bmMessage,
          buyer.lastUpdatedBy,
          COUNT(*) AS noOfExhibitorsInBmList,
          COUNT(CASE WHEN listItems.interestedStatus = 0 then 1 ELSE NULL END) AS totalInterest0Status,
          COUNT(CASE WHEN listItems.interestedStatus = 1 then 1 ELSE NULL END) AS totalInterest1Status,
          COUNT(CASE WHEN listItems.interestedStatus = 2 then 1 ELSE NULL END) AS totalInterest2Status
        FROM 
          vep_c2m_service_db.vepC2MBMRecommendation buyer 
        INNER JOIN vep_c2m_service_db.vepC2MBMRecommendationItem listItems ON listItems.recommendationId = buyer.id 
        LEFT JOIN vep_c2m_service_db.vepC2MNotification noti 
          ON ( noti.refUserId = buyer.ssoUid 
          AND noti.refFairCode = buyer.fairCode
          AND noti.refFiscalYear = buyer.fairYear
          AND noti.notificationType = '${reminderNotiType}'
          )
        WHERE sentTime IN (SELECT MAX(sentTime) FROM vep_c2m_service_db.vepC2MBMRecommendation WHERE publishType = 'external' GROUP BY ssoUid, fairCode, fairYear)
        AND buyer.fairCode in (${currFair.fairCodeSQL})
        AND buyer.fairYear in (${currFair.fiscalYearSQL})  
        AND noti.id is null  
        GROUP BY listItems.recommendationId
        HAVING totalInterest1Status = 0 AND totalInterest2Status = 0
      ) noResponseReminder
      LEFT JOIN vepC2MNotification notiNumber
      ON ( notiNumber.refUserId = noResponseReminder.ssoUid
        AND notiNumber.refFairCode = noResponseReminder.fairCode
        AND notiNumber.refFiscalYear = noResponseReminder.fairYear
        AND notiNumber.templateId = ${NotificationTemplatesId.NO_RESPONSE_REMINDER} 
        AND notiNumber.channelType = '${ChannelType.EMAIL}' )
        GROUP BY ssoUid, fairCode, fairYear
        having sentNotiNum < ${noResponseMax}
        LIMIT ${this.scheduleJobLimitNoResponseInBmList}
      `;
      console.log(query);

      return Promise.all([fairEndDayBefore, noResponseInterval, noResponseMax, isBetweenSendingPeriod, getConnection().query(query)]);
    })
    .then(([fairEndDayBefore, noResponseInterval, noResponseMax, isBetweenSendingPeriod, allTargetBuyers]: any) => {
      if (allTargetBuyers.length === 0 ) {
        this.logger.log(JSON.stringify({ action: 'get target user list', section: 'Notification - noResponseInBmList', step: '5', detail: `no users need to send` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.SUCCESS,
          message: `no users need to send in ${currFair.fairCodeSQL} and ${currFair.fiscalYearSQL}, allTargetBuyers: ${JSON.stringify(allTargetBuyers)}`
        })
      }

      let resultArray: Promise<any>[] = [];
      allTargetBuyers.forEach(async (buyer: any) => {
        resultArray.push(
          this.notificationService.checkNotiSentPerUsers(NotificationTemplatesId.NO_RESPONSE_REMINDER, ChannelType.EMAIL, buyer.ssoUid, buyer.fairCode, buyer.fairYear)
          .then((sentNotiResult) => {
            // setup lastest BM list sent time - UTC
            const latestBmListSentTime = moment.tz(buyer.sentTime, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong').utc();
            // setup lastest BM list sent time - HKT
            const latestBmListSentTimeHKT = moment.tz(buyer.sentTime, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong');
            // setup astest BM list sent date - HKT
            const latestBmListSentDateHKT = latestBmListSentTimeHKT.startOf('day');
            // setup the day difference between Current Date and Lastest BM List Sent Date -  HKT
            const diffDate = moment.duration(currentDateHKT.diff(latestBmListSentDateHKT)).asDays();
            // check whether Current Time is between Lastest BM List Sent Date and fairEndDayBefore -  UTC
            const isBetweenLatestBmListSentDayAndNoOfDayBeforeEndDay = currentTime.isBetween(latestBmListSentTime, fairEndDayBefore);
            const sentNotiNumber = sentNotiResult.length;
            console.log(sentNotiNumber)

            /* "buyer.fairCode === currFair.fairData[0].fairCode": handle the situation when more than one fairs are exist in the same C2M period
            /* (buyer fairCode maybe different with the currFair.fairCode)
            */
            if ((isBetweenLatestBmListSentDayAndNoOfDayBeforeEndDay && buyer.fairCode === currFair.fairData[0].fairCode) && ((diffDate !== 0) && (diffDate % (noResponseInterval + 1) === 0)) && (isBetweenSendingPeriod)) {
              this.logger.log(JSON.stringify({ section: 'Notification - BM list Summary', action: `sendSQSNotificationForBmList - start sending noti (noResponseInBmList): ${buyer.ssoUid}, fairCode: ${buyer.fairCode}, fiscalYear: ${buyer.fairYear}, templateId: ${NotificationTemplatesId.NO_RESPONSE_REMINDER}`, step: '1' }));
              return this.c2mService.handleNotificationForBmList({
                templateId: NotificationTemplatesId.NO_RESPONSE_REMINDER,
                notificationType: reminderNotiType,
                receiverRole: ReceiverRole.BUYER,
                userData: buyer
              })
            } else {
              return {
                status: constant.COMMON_CONSTANT.SUCCESS,
                message: 'not fullill the sending conditions',
                data: buyer
              }
            }
          })
          .catch(error => {
            this.logger.log(JSON.stringify({
              action: `Notification - noResponseInBmList catch error`,
              section: `Notification - noResponseInBmList`,
              step: 'catch error',
              detail: `find notification record fail. error message: ${error}`
            }));
            return {
              status: constant.COMMON_CONSTANT.FAIL,
              message: `find notification record fail. error message: ${error}`,
              data: {
                ssoUid: buyer.ssoUid,
                fairCode: buyer.fairCode,
                fairYear: buyer.fairYear
              }
            }
          })
        )
      });
      return Promise.all(resultArray);
    })
    .catch((error) => {
      this.logger.log(JSON.stringify({ action: 'noResponseInBmList - error', section: 'Notification - noResponseInBmList', step: 'catch error', detail: error }));
      return {
        status: 400,
        message: `catch error detail of ${reminderNotiType}: ${JSON.stringify(error)}`,
      };
    });
  }

  /*
  Not Enough Interest

  Internval : Every Min

  Send reminder to user when not enough “Interest“ is received (1 <= “Interest“ < config value of no. of interest received)
  */
  public async notEnoughInterestInBmList(currFair: Record<string, any>): Promise<any> {
    const reminderNotiType = NotificationType.NOT_ENOUGH_INTEREST_REMINDER + '_' +  moment().tz('Asia/Hong_Kong').format('YYYY_MM_DD');

    // setup current time - UTC
    const currentTime = moment().utc();
    // setup current time - HKT
    const currentTimeHKT = moment().tz('Asia/Hong_Kong');
    // setup current date - HKT (i.e. set HH:MM:SS to 00:00:00 - HKT)
    const currentDateHKT = moment().tz('Asia/Hong_Kong').startOf('day');

    // handle config value - No. of days before C2M end day
    let fairEndDayBefore: moment.Moment;
    // handle config value - Interval (day) of checking
    let notEnoughInterestInterval: number;
    // handle config value - Maximum number of receive no response
    let notEnoughInterestMax: number;
    // handle config value - Time of sending
    let notEnoughInterestSendingTimeHKT: moment.Moment;
    // handle config value - No. of interest received
    let noOfInterestConfig;

    return this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_DAY_2.id })
    .then((notEnoughInterestNoOfDayBeforeEndDayConfigResult: any) => {
      if (notEnoughInterestNoOfDayBeforeEndDayConfigResult.status !== 200 || !notEnoughInterestNoOfDayBeforeEndDayConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (no. of days before C2M end day)', section: 'notEnoughInterestInBmList', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_DAY_2.id} config value` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_DAY_2.id} config value`
        })
      }
      const notEnoughInterestNoOfDayBeforeEndDayConfig = notEnoughInterestNoOfDayBeforeEndDayConfigResult?.data?.configValue;
      const notEnoughInterestNoOfDayBeforeEndDay = Number(notEnoughInterestNoOfDayBeforeEndDayConfig);
      fairEndDayBefore = moment.tz(currFair.c2mEndDatetime, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong').subtract(notEnoughInterestNoOfDayBeforeEndDay, 'd').utc();

      this.logger.log(JSON.stringify({ action: 'get config value (no. of days before C2M end day)', section: 'notEnoughInterestInBmList', step: '1', detail: `only send the noti before C2M end day ${notEnoughInterestNoOfDayBeforeEndDay} day` }));
      return Promise.all([fairEndDayBefore, this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_DAY_1.id })]);
    })
    .then(([fairEndDayBefore, notEnoughInterestIntervalConfigResult]: any) => {
      if (notEnoughInterestIntervalConfigResult.status !== 200 || !notEnoughInterestIntervalConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (interval of day)', section: 'notEnoughInterestInBmList', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_DAY_1.id} config value` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_DAY_1.id} config value`
        })
      }
      const notEnoughInterestIntervalConfig = notEnoughInterestIntervalConfigResult?.data?.configValue;
      notEnoughInterestInterval = Number(notEnoughInterestIntervalConfig);

      this.logger.log(JSON.stringify({ action: 'get config value (interval of day)', section: 'notEnoughInterestInBmList', step: '2', detail: `every ${notEnoughInterestInterval} day check the notEnoughInterest noti need to send or not` }));
      return Promise.all([fairEndDayBefore, notEnoughInterestInterval, this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_NUMBER_2.id })]);
    })
    .then(([fairEndDayBefore, notEnoughInterestInterval, notEnoughInterestMaxConfigResult]: any) => {
      if (notEnoughInterestMaxConfigResult.status !== 200 || !notEnoughInterestMaxConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (max number of no response)', section: 'notEnoughInterestInBmList', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_NUMBER_2.id} config value` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_NUMBER_2.id} config value`
        })
      }

      const notEnoughInterestMaxConfig = notEnoughInterestMaxConfigResult?.data?.configValue;
      notEnoughInterestMax = Number(notEnoughInterestMaxConfig);

      this.logger.log(JSON.stringify({ action: 'get config value (max number of no response)', section: 'notEnoughInterestInBmList', step: '3', detail: `when no of noti sent >= ${notEnoughInterestMax}, then stop sending noti` }));
      return Promise.all([fairEndDayBefore, notEnoughInterestInterval, notEnoughInterestMax, this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_TIME.id })]);
    })
    .then(([fairEndDayBefore, notEnoughInterestInterval, notEnoughInterestMax, notEnoughInterestSendingTimeConfigResult]: any) => {
      if (notEnoughInterestSendingTimeConfigResult.status !== 200 || !notEnoughInterestSendingTimeConfigResult) {
        this.logger.log(JSON.stringify({ action: 'get config value (sending time)', section: 'notEnoughInterestInBmList', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_TIME.id} config value` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_TIME.id} config value`
        })
      }

      // handle config value - Time of sending + 15mins
      // let notEnoughInterestSendingTimeAdd15MinsHKT: moment.Moment;

      // notEnoughInterestSendingTimeHKT = moment.tz(notEnoughInterestSendingTimeConfig, 'HH:mm', 'Asia/Hong_Kong');
      // notEnoughInterestSendingTimeAdd15MinsHKT = moment.tz(notEnoughInterestSendingTimeConfig, 'HH:mm', 'Asia/Hong_Kong').add(60, 'minutes');

      // let isBetweenSendingPeriod: boolean = currentTimeHKT.isBetween(notEnoughInterestSendingTimeHKT, notEnoughInterestSendingTimeAdd15MinsHKT);

      const notEnoughInterestSendingTimeConfig = notEnoughInterestSendingTimeConfigResult?.data?.configValue;
      let currentDateHKTForSending = moment().tz('Asia/Hong_Kong').format("YYYY-MM-DD");
      let notEnoughInterestSendingTimeHKTString = currentDateHKTForSending + 'T' + notEnoughInterestSendingTimeConfig + ':00'
      notEnoughInterestSendingTimeHKT  = moment.tz(notEnoughInterestSendingTimeHKTString, 'Asia/Hong_Kong');

      let currentDayEndTimeHKT: moment.Moment = moment().tz('Asia/Hong_Kong').endOf('day')
      let isBetweenSendingPeriod = currentTimeHKT.isBetween(notEnoughInterestSendingTimeHKT, currentDayEndTimeHKT);

      console.log(`when current time (${currentTimeHKT}) is between ${notEnoughInterestSendingTimeHKT} and ${currentDayEndTimeHKT}, then send noti`);

      this.logger.log(JSON.stringify({ action: 'get config value (sending time)', section: 'notEnoughInterestInBmList', step: '4', detail: `when current time >= ${notEnoughInterestSendingTimeHKT}, then send noti` }));
      return Promise.all([fairEndDayBefore, notEnoughInterestInterval, notEnoughInterestMax, isBetweenSendingPeriod, this.c2mService.getConfigValueById({ id: CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_NUMBER_1.id })]);
    })
    .then(([fairEndDayBefore, notEnoughInterestInterval, notEnoughInterestMax, isBetweenSendingPeriod, noOfInterestConfigResult]: any) => {
      if (noOfInterestConfigResult.status !== 200 || !noOfInterestConfigResult.data) {
        this.logger.log(JSON.stringify({ action: 'get config value (no of interest)', section: 'notEnoughInterestInBmList', step: 'error', detail: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_NUMBER_1.id} config value` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.FAIL,
          message: `cannot get the ${CONFIG.NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_NUMBER_1.id} config value`
        })
      }
      noOfInterestConfig = noOfInterestConfigResult.data.configValue;

      this.logger.log(JSON.stringify({ action: 'get config value (no of interest)', section: 'notEnoughInterestInBmList', step: '5', detail: `when the number of interest the buyer response < ${noOfInterestConfig}, then send noti` }));
      return Promise.all([fairEndDayBefore, notEnoughInterestInterval, notEnoughInterestMax, isBetweenSendingPeriod, noOfInterestConfig]);
    })
    .then(async ([fairEndDayBefore, notEnoughInterestInterval, notEnoughInterestMax, isBetweenSendingPeriod, noOfInterestConfig]: any) => {
      // let query = `
      //   SELECT 
      //     buyer.id,
      //     listItems.recommendationId,
      //     buyer.ssoUid,
      //     buyer.fairCode,
      //     buyer.fairYear,
      //     buyer.sentTime,
      //     buyer.lastUpdatedBy,
      //     COUNT(*) AS noOfExhibitorsInBmList,
      //     COUNT(CASE WHEN listItems.interestedStatus = 0 then 1 ELSE NULL END) AS totalInterest0Status,
      //     COUNT(CASE WHEN listItems.interestedStatus = 1 then 1 ELSE NULL END) AS totalInterest1Status,
      //     COUNT(CASE WHEN listItems.interestedStatus = 2 then 1 ELSE NULL END) AS totalInterest2Status
      //   FROM 
      //     vep_c2m_service_db.vepC2MBMRecommendation buyer 
      //   INNER JOIN vep_c2m_service_db.vepC2MBMRecommendationItem listItems ON listItems.recommendationId = buyer.id 
      //   LEFT JOIN vep_c2m_service_db.vepC2MNotification noti 
      //     ON ( noti.refUserId = buyer.ssoUid 
      //     AND noti.refFairCode = buyer.fairCode
      //     AND noti.refFiscalYear = buyer.fairYear
      //     AND noti.notificationType = '${reminderNotiType}'
      //     )
      //   WHERE sentTime IN (SELECT MAX(sentTime) FROM vep_c2m_service_db.vepC2MBMRecommendation WHERE publishType = 'external' GROUP BY ssoUid, fairCode, fairYear)
      //   AND buyer.fairCode in (${currFair.fairCodeSQL})
      //   AND buyer.fairYear in (${currFair.fiscalYearSQL})  
      //   AND noti.id is null  
      //   GROUP BY listItems.recommendationId
      //   HAVING (totalInterest1Status != 0 AND totalInterest1Status < ${noOfInterestConfig}) OR (totalInterest2Status != 0 AND totalInterest1Status < ${noOfInterestConfig})
      //   LIMIT ${this.scheduleJobLimitNotEnoughInterestInBmList}
      // `
      let query = `
      SELECT notEnoughReminder.*, COUNT(*) as sentNotiNum from 
      (
        SELECT 
          buyer.id,
          listItems.recommendationId,
          buyer.ssoUid,
          buyer.fairCode,
          buyer.fairYear,
          buyer.sentTime,
          buyer.lastUpdatedBy,
          COUNT(*) AS noOfExhibitorsInBmList,
          COUNT(CASE WHEN listItems.interestedStatus = 0 then 1 ELSE NULL END) AS totalInterest0Status,
          COUNT(CASE WHEN listItems.interestedStatus = 1 then 1 ELSE NULL END) AS totalInterest1Status,
          COUNT(CASE WHEN listItems.interestedStatus = 2 then 1 ELSE NULL END) AS totalInterest2Status
        FROM 
          vep_c2m_service_db.vepC2MBMRecommendation buyer 
        INNER JOIN vep_c2m_service_db.vepC2MBMRecommendationItem listItems ON listItems.recommendationId = buyer.id 
        LEFT JOIN vep_c2m_service_db.vepC2MNotification noti 
          ON ( noti.refUserId = buyer.ssoUid 
          AND noti.refFairCode = buyer.fairCode
          AND noti.refFiscalYear = buyer.fairYear
          AND noti.notificationType = '${reminderNotiType}'
          )
        WHERE 
        buyer.sentTime IN (
          SELECT
            latest.sentTime as latestSentTime
          FROM
            vep_c2m_service_db.vepC2MBMRecommendation latest
          LEFT JOIN vep_c2m_service_db.vepC2MBMRecommendation latest2 ON (
            (
            latest.ssouid = latest2.ssouid AND
            latest.fairCode = latest2.fairCode AND
            latest.fairYear = latest2.fairYear AND
            latest.publishType = latest2.publishType AND
            latest.sentTime < latest2.sentTime
            )
            )
          WHERE latest2.id IS NULL 
          GROUP BY latest.ssouid , latest.fairCode , latest.fairYear, latest.publishType
          HAVING latest.publishType = 'external'
        )
        AND buyer.id IN (
          SELECT
            latest.id as latestId
          FROM
            vep_c2m_service_db.vepC2MBMRecommendation latest
          LEFT JOIN vep_c2m_service_db.vepC2MBMRecommendation latest2 ON (
            (
            latest.ssouid = latest2.ssouid AND
            latest.fairCode = latest2.fairCode AND
            latest.fairYear = latest2.fairYear AND
            latest.publishType = latest2.publishType AND
            latest.sentTime < latest2.sentTime
            )
            )
          WHERE latest2.id IS NULL 
          GROUP BY latest.ssouid , latest.fairCode , latest.fairYear, latest.publishType
          HAVING latest.publishType = 'external'
        )

        AND buyer.fairCode in (${currFair.fairCodeSQL})
        AND buyer.fairYear in (${currFair.fiscalYearSQL}) 
        AND noti.id is null  
        GROUP BY listItems.recommendationId
        HAVING (totalInterest1Status != 0 AND totalInterest1Status < ${noOfInterestConfig}) OR (totalInterest2Status != 0 AND totalInterest1Status < ${noOfInterestConfig})
      ) notEnoughReminder
	    LEFT JOIN vepC2MNotification notiNumber
      ON ( notiNumber.refUserId = notEnoughReminder.ssoUid
      AND notiNumber.refFairCode = notEnoughReminder.fairCode
      AND notiNumber.refFiscalYear = notEnoughReminder.fairYear
      AND notiNumber.templateId = ${NotificationTemplatesId.NOT_ENOUGH_INTEREST_REMINDER}
      AND notiNumber.channelType = '${ChannelType.EMAIL}' )
      GROUP BY ssoUid, fairCode, fairYear
      HAVING sentNotiNum < ${notEnoughInterestMax}
      LIMIT ${this.scheduleJobLimitNotEnoughInterestInBmList}
      `;
      console.log(query);

      return Promise.all([fairEndDayBefore, notEnoughInterestInterval, notEnoughInterestMax, isBetweenSendingPeriod, getConnection().query(query)]);
    })
    .then(([fairEndDayBefore, notEnoughInterestInterval, notEnoughInterestMax, isBetweenSendingPeriod, allTargetBuyers]: any) => {
      if (allTargetBuyers.length === 0 ) {
        this.logger.log(JSON.stringify({ action: 'get target user list', section: 'notEnoughInterestInBmList', step: '6', detail: `no users need to send` }));
        return Promise.reject({
          status: constant.COMMON_CONSTANT.SUCCESS,
          message: `no users need to send`
        })
      }

      let resultArray: Promise<any>[] = [];
      allTargetBuyers.forEach(async (buyer: any) => {
        resultArray.push(
          this.notificationService.checkNotiSentPerUsers(NotificationTemplatesId.NOT_ENOUGH_INTEREST_REMINDER, ChannelType.EMAIL, buyer.ssoUid, buyer.fairCode, buyer.fairYear)
          .then((sentNotiResult) => {
            // setup lastest BM list sent time - UTC
            const latestBmListSentTime = moment.tz(buyer.sentTime, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong').utc();
            // setup lastest BM list sent time - HKT
            const latestBmListSentTimeHKT = moment.tz(buyer.sentTime, 'YYYY-MM-DD HH:mm', 'Asia/Hong_Kong');
            // setup astest BM list sent date - HKT
            const latestBmListSentDateHKT = latestBmListSentTimeHKT.startOf('day');
            // set up the day difference between Current Date and Lastest BM List Sent Date -  HKT
            const diffDate = moment.duration(currentDateHKT.diff(latestBmListSentDateHKT)).asDays();
            const isBetweenLatestBmListSentDayAndNoOfDayBeforeEndDay = currentTime.isBetween(latestBmListSentTime, fairEndDayBefore);

            // const sentNotiResult = await this.notificationService.checkNotiSentPerUsers(NotificationTemplatesId.NOT_ENOUGH_INTEREST_REMINDER, ChannelType.EMAIL, buyer.ssoUid, buyer.fairCode, buyer.fairYear);
            const sentNotiNumber = sentNotiResult.length;
            console.log(sentNotiNumber)

            /* "buyer.fairCode === currFair.fairData[0].fairCode": handle the situation when more than one fairs are exist in the same C2M period
            /* (buyer fairCode maybe different with the currFair.fairCode)
            */
            if ((isBetweenLatestBmListSentDayAndNoOfDayBeforeEndDay && buyer.fairCode === currFair.fairData[0].fairCode) && (diffDate % (notEnoughInterestInterval + 1) === 0) && (isBetweenSendingPeriod)) {
              this.logger.log(JSON.stringify({ section: 'Notification - BM list Summary', action: `sendSQSNotificationForBmList - start sending noti (notEnoughInterestInBmList): ${buyer.ssoUid}, fairCode: ${buyer.fairCode}, fiscalYear: ${buyer.fairYear}, templateId: ${NotificationTemplatesId.NOT_ENOUGH_INTEREST_REMINDER}`, step: '1' }));
              return this.c2mService.handleNotificationForBmList({
                templateId: NotificationTemplatesId.NOT_ENOUGH_INTEREST_REMINDER,
                notificationType: reminderNotiType,
                receiverRole: ReceiverRole.BUYER,
                userData: buyer
              });
            } else {
              return {
                status: constant.COMMON_CONSTANT.SUCCESS,
                message: 'not fullill the sending conditions',
                data: buyer
              }
            }
          })
          .catch(error => {
            return {
              status: constant.COMMON_CONSTANT.FAIL,
              message: `find notification record fail. error message: ${error}`,
              data: {
                ssoUid: buyer.ssoUid,
                fairCode: buyer.fairCode,
                fairYear: buyer.fairYear
              }
            }
          })
        )
      })
      return Promise.all(resultArray);
    })
    .catch((error) => {
      this.logger.log(JSON.stringify({ section: 'catch error', action: 'noResponseInBmList - error', step: 'error', detail: error }));
      return {
        status: 400,
        message: `catch error detail of ${reminderNotiType}: ${JSON.stringify(error)}`,
      };
    });
  }
  // ------------------------------------------------ End of  R2B BM List Notification ------------------------------------------------ // 

  public checkTimeFromLambdaToC2m(lambdaTriggerTime: Date, enterC2mTime: Date, randomString: string) {
    let timeFromLambdaToC2m;
    timeFromLambdaToC2m = enterC2mTime.getTime() - lambdaTriggerTime.getTime()
    timeFromLambdaToC2m = timeFromLambdaToC2m / 1000

    this.logger.log(JSON.stringify({ action: 'trigger endpoint', section: 'Notification - cron job seminarSummaryReminder', step: '1', detail: `key: ${randomString}. time of triggering: ${lambdaTriggerTime} in c2m service. lambda to c2m time: ${timeFromLambdaToC2m}s.` }));

    // rule: 60s -> low limit: 50 ; high limit: 70
    if (timeFromLambdaToC2m > 50 && timeFromLambdaToC2m < 70) {
      return true;
    } else {
      return false;
    }
  }
}

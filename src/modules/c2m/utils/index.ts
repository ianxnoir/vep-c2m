import moment from 'moment-timezone';
import { ReceiverRole } from '../notification/notification.type';

export const checkInputTimeIsPassCurrentTime = (inputTime: string): boolean => moment(inputTime).isAfter(moment().tz('UTC', true));

export const remapUserProfile = (userProfile: Record<string, any>) => {
  const preferredLanguage = remapLanguage(userProfile?.preferredLanguage);
  return {
    country: userProfile.addressCountryCode?.[preferredLanguage] || userProfile.country?.[preferredLanguage],
    companyName: userProfile?.companyName || userProfile?.company,
    emailId: userProfile?.emailId || userProfile?.contactEmail,
    preferredLanguage: preferredLanguage,
    userTimezone: userProfile?.userTimezone,
    userId: userProfile?.ssoUid || userProfile?.companyCCDID,
    preferredChannel: userProfile?.preferredChannel,
    overseasBranchOffice: userProfile.overseasBranchOffice || '',
    registrationNo: userProfile.registrationNo
  }
}

export const remapCounterUserProfile = (userProfile: Record<string, any>, counterProfile: Record<string, any>) => {
  const preferredLanguage = remapLanguage(userProfile?.preferredLanguage);
  return {
    country: counterProfile.addressCountryCode?.[preferredLanguage] || counterProfile.country?.[preferredLanguage],
    companyName: counterProfile?.companyName || counterProfile?.company,
    emailId: counterProfile?.emailId || counterProfile?.contactEmail,
    preferredLanguage: preferredLanguage,
    userTimezone: counterProfile?.userTimezone,
    userId: counterProfile?.ssoUid || counterProfile?.companyCCDID
  }
}

// export const remapUserProfileForSummary = (user: Record<string, any>, userRole: string) => {
//   // let firstName;
//   // let lastName;
//   // let emailId;
//   // let preferredLanguage;
//   // let userTimezone;

//   // if (userRole === ReceiverRole.BUYER) {
//   //   const language = meetingData.buyerPreferredLanguage;
//   //   firstName = meetingData.buyerFirstName;
//   //   lastName = meetingData.buyerLasttName;
//   //   emailId = meetingData.buyerEmail;
//   //   preferredLanguage = remapLanguage(language);
//   //   userTimezone = meetingData.buyerTz;
//   // } else {
//   //   const language = 'en';
//   //   firstName = meetingData.exhiobitorFirstName;
//   //   lastName = meetingData.exhiobitorLasttName;
//   //   emailId = meetingData.exhiobitorEmail;
//   //   preferredLanguage = remapLanguage(language);
//   //   userTimezone = meetingData.exhibitorTz;
//   // }

//   return {
//     user.firstName,
//     user.lastName,
//     emailId,
//     preferredLanguage,
//     userTimezone
//     // preferredChannel: userDataV2.data.preferredChannels
//   }
// }

export const remapTableDataForSummary = (meetingData: Record<string, any>, userRole: string) => {
  const language = userRole === ReceiverRole.BUYER ? meetingData.preferredLanguage : 'en';
  const preferredLanguage = remapLanguage(language);

  return {
    country: userRole === ReceiverRole.BUYER ? meetingData.buyerCountryCode : meetingData.exhibitorCountryCode,
    companyName: userRole === ReceiverRole.BUYER ? meetingData.buyercompanyName : meetingData.exhibitorCompanyName,
    emailId: userRole === ReceiverRole.BUYER ? meetingData.buyerEmail : meetingData.exhibitorEmail,
    preferredLanguage: preferredLanguage,
    userTimezone: userRole === ReceiverRole.BUYER ? meetingData.userTimezone : 'Asia/Hong_Kong',
    // preferredChannel: userDataV2.data.preferredChannels
  }
}

export const remapLanguage = (language: string) => {
  switch (true) {
    case language === 'tc' || language === 'zh-Hant':
      return 'tc';

    case language === 'sc' || language === 'zh-Hans':
      return 'sc';

    case language === 'en':
      return 'en';

    default:
      return 'en';
  }
}
import { VepErrorObj } from '../core/exception/exception';

export const VepErrorMsg: VepErrorObj = {
    General_Error: { code: 'E0800100001', message: 'General Error', status: 400 },

    HiddenRecord_GetNotInterestedByFairList_FairsParse_Error: { code: 'E0800200001', message: 'Fail to parse fairs', status: 400 },

    Recommendation_BMAIService_Error: { code: 'E0800300001', message: 'Error in call BMAI Service', status: 400 },

    Admin_Invalid_Jwt: { code: 'E0804000010', message: 'Invalid Jwt Token', status: 401 },
};

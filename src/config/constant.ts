const COMMON_CONSTANT = {
  SUCCESS: 200,
  FAIL: 400
};

export const constant = {
  COMMON_CONSTANT,
  GENERAL_STATUS: {
    SUCCESS: COMMON_CONSTANT.SUCCESS,
    FAIL: COMMON_CONSTANT.FAIL,
  },
  API_RESPONSE_CODE: {
    SUCCESS: COMMON_CONSTANT.SUCCESS,
    FAIL: COMMON_CONSTANT.FAIL,
  },
  API_RESPONSE_FIELDS: {
    STATUS: 'status',
    MESSAGE: 'message'
  },
  FAIR_RELATIONSHIP: {
    SINGLE: 'single',
    COMBINED: 'combined',
    NO_RECORD: 'no fair record found'
  },
  MEETING: {
    ERROR_MESSAGE: {
      SYSTEM_ERROR: 'The system is busy, please try again later.',
      STARTTIME_OVER_CURRENT_TIME: 'startTime over current time',
      NO_FAIRCODE_OR_FISCALYEAR: 'no fairCode or fiscalYear data returned',
      NO_FAIRDATE: 'no fair dates returned',
      NO_MEETINGTYPE: 'no meeting type found',
      OUT_OF_FAIR_PERIOD: 'meeting start time or end time is out of fair period',
      COLLIDED_MEETING: 'There are collided meetings in same timeslot. Please select another meeting time slot.',
      SAME_REQUESTER_RESPONDER: 'requester and Responder cannot be same',
      BUYER_PROFILE_NOT_FOUND: 'buyer user profile not found',
      EXHIBITOR_PROFILE_NOT_FOUND: 'exhibitor user profile not found',
      BUYER_RESTRICTED: 'buyer had been restricted',
      EXHIBITOR_RESTRICTED: 'exhibitor had been restricted',
      NO_MEETING_DATA_FOUND: 'no meeting data found',
      MEETING_RELATIONSHIP_WRONG: 'Meeting is not belong to {ssoUid}',
      MEETING_STATUS_IS_NOT_PENDING_ACCEPTED: 'Meeting status is not pending / accepted',
      MEETING_CANNOT_BE_RESCHEDULE: 'Meeting cannot be rescheduled',
      CANCELLED_REASON_IS_MISSING: 'cancelledReason is missing',
      MEETING_CANNOT_BE_CANCELLED: 'Meeting cannot be cancelled',
      MISSING_TIMESLOT: 'Please select your available meeting time slot',
      MISSING_MEETING_NAME: 'Meeting name is required',
      MISSING_BOOTH_NUMBER: "Exhibitor's booth number is required for face to face meeting",
      NO_VALID_MEETING_TIME: 'No valid meeting time ',
      FAIL_TO_GET_REGISTERED_SEMINAR: 'Fail to get registered seminar',
      COLLIDED_SEMINAR: 'COLLIDED_SEMINAR',
    },
    CREATE: {
      SUCCESS: COMMON_CONSTANT.SUCCESS,
      FAIL: 999
    },
    UPDATE: {
      SUCCESS: COMMON_CONSTANT.SUCCESS,
      FAIL: 999
    }
  },
  CHATROOM: {
    ERROR_MESSAGE: {
      NO_AVAILABLE_ROOM: 'Reached sendbird quota limit',
      NO_MEETING_ID_FOUND: 'no meeting id found',
    },
  },
  ADMIN_PORTAL: {
    WRONG_USER_TOKEN: 'Wrong user token',
    ADMIN_NOT_FOUND: 'Admin ID not found',
    USER_ROLE_NOT_FOUND: 'User role detail not found',
    NO_ACCESS_RIGHT_FAIRCODE: 'Access denied(Fair code)'
  },
  RECOMMENDATION: {
    BY_TDC: {
      NO_RECORD_FOUND: 'no recommended record found',
      STATUS_UPDATE_WRONG: 'status cannot be updated'
    }
  }
};

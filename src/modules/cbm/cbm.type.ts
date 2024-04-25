import { OnlineMeetingStatus } from '../c2m/meeting/meeting.type';

export enum SortingType {
  ASC = 'ASC',
  DESC = 'DESC'
}

export type PaginateOption = {
  pageNum: number;
  rowsPerPage: number;
};

export type SearchOption = string | undefined;

export type SortingOption = Record<string, SortingType>;

export type MeetingFilter = {
  startTime: Date | null,
  endTime: Date | null,
  onlineMeetingStatus?: OnlineMeetingStatus[] | null,
};

export enum C2mConfigUnit {
  MINUTE = 'MINUTE',
  DAY = 'DAY',
  TIME = 'TIME',
  NUMBER = 'NUMBER',
  SIZE = 'SIZE'
}

export enum C2mConfigSection {
  NOTIFICATION_MEETING = 'NOTIFICATION_MEETING',
  NOTIFICATION_SEMINAR = 'NOTIFICATION_SEMINAR',
  SENDBIRD = 'SENDBIRD'
}

export const CONFIG = {
  NOTIFICATION_SEMINAR_SEMINAR_SUMMARY_REMINDER_TIME: {
    id: 1,
    section: C2mConfigSection.NOTIFICATION_SEMINAR,
    unit: C2mConfigUnit.TIME
  },
  NOTIFICATION_SEMINAR_SEMINAR_SUMMARY_REMINDER_DAY: {
    id: 2,
    section: C2mConfigSection.NOTIFICATION_SEMINAR,
    unit: C2mConfigUnit.DAY
  },
  NOTIFICATION_SEMINAR_ATTENDING_SEMINAR_REMINDER_MINUTE: {
    id: 3,
    section: C2mConfigSection.NOTIFICATION_SEMINAR,
    unit: C2mConfigUnit.MINUTE
  },
  NOTIFICATION_SEMINAR_KOL_EVENT_REMINDER_MINUTE: {
    id: 4,
    section: C2mConfigSection.NOTIFICATION_SEMINAR,
    unit: C2mConfigUnit.MINUTE
  },
  NOTIFICATION_SEMINAR_FEEDBACK_FORM_REMINDER_DAY: {
    id: 5,
    section: C2mConfigSection.NOTIFICATION_SEMINAR,
    unit: C2mConfigUnit.DAY
  },
  NOTIFICATION_SEMINAR_FEEDBACK_FORM_REMINDER_TIME: {
    id: 6,
    section: C2mConfigSection.NOTIFICATION_SEMINAR,
    unit: C2mConfigUnit.TIME
  },
  NOTIFICATION_MEETING_DAILY_MEETING_SUMMARY_DAY: {
    id: 7,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.DAY
  },
  NOTIFICATION_MEETING_C2M_START_REMINDER_DAY: {
    id: 8,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.DAY
  },
  NOTIFICATION_MEETING_DAILY_MEETING_SUMMARY_TIME: {
    id: 9,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.TIME
  },
  NOTIFICATION_MEETING_C2M_START_REMINDER_TIME: {
    id: 10,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.TIME
  },
  NOTIFICATION_MEETING_MEETING_REMINDER_MINUTE: {
    id: 11,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.MINUTE
  },
  NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_TIME: {
    id: 12,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.TIME
  },
  NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_DAY_1: {
    id: 13,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.DAY
  },
  NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_DAY_2: {
    id: 14,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.DAY
  },
  NOTIFICATION_MEETING_NO_RESPONSE_REMINDER_NUMBER: {
    id: 15,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.NUMBER
  },
  NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_NUMBER_1: {
    id: 16,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.NUMBER
  },
  NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_DAY_1: {
    id: 17,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.DAY
  },
  NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_TIME: {
    id: 18,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.TIME
  },
  NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_DAY_2: {
    id: 19,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.DAY
  },
  NOTIFICATION_MEETING_NOT_ENOUGH_INTEREST_REMINDER_NUMBER_2: {
    id: 20,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.NUMBER
  },
  NOTIFICATION_MEETING_C2M_KICK_OFF_BUYER_TIME: {
    id: 21,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.TIME
  },
  NOTIFICATION_MEETING_C2M_KICK_OFF_BUYER_DAY: {
    id: 22,
    section: C2mConfigSection.NOTIFICATION_MEETING,
    unit: C2mConfigUnit.DAY
  }
}
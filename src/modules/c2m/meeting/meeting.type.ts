export enum MeetingStatus {
  PENDING = 0,
  ACCEPTED = 1,
  CANCELLED = 2,
  REJECTED = 3,
  AUTO_CANCELLED = 4,
  RELEASED = 5
}

export enum LiveStatus {
  PENDING = 0,
  RUNNING = 1,
  ENDED = 2
}

export enum MeetingType {
  ONLINE = 0,
  F2F = 1
}

export enum JoinMeetingStatus {
  NO_SHOW = 0,
  JOINED = 1,
  LEAVED = 2
}

export enum MeetingRole {
  BUYER = 'BUYER',
  EXHIBITOR = 'EXHIBITOR',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM'
}

export enum TdcCancelByEnum {
  BUYER = 'BUYER',
  EXHIBITOR = 'EXHIBITOR',
  OTHERS = 'OTHERS'
}

export enum ResponseStatus {
  PENDING = 'PENDING',
  REQ_RESCHEDULE = 'REQ_RESCHEDULE',
  REQ_CANCEL = 'REQ_CANCEL',
  TDC_CANCEL = 'TDC_CANCEL', // no longer support
  SYS_CANCEL = 'SYS_CANCEL',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  REQ_REJECT = 'REQ_REJECT',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  TDC_CANCEL_BUYER = 'TDC_CANCEL_BUYER',
  TDC_CANCEL_EXHIBITOR = 'TDC_CANCEL_EXHIBITOR',
  TDC_CANCEL_OTHERS = 'TDC_CANCEL_OTHERS'
}

/**
 * Email Situation
 * BM assign meeting to Buyer and Exhibitor, treat them as accepting email, sent them a email
 * requester -> responser, send email to responser, send email back to requester
 */

export enum EmailDeliveryStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  SENT = 'SENT'
}

export enum OnlineMeetingStatus {
  NONE = 'NONE',
  UPCOMING = 'UPCOMING',
  CHECKEDIN = 'CHECKEDIN',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED'
}

export const MEETING_READY_BEFORE = 15;

export const MESSAGE_TYPE = {
  TEXT: 'TEXT',
  SYSTEM: 'SYSTEM',
  FILE: 'FILE',
  SCAN_ATTACHMENT: 'SCAN_ATTACHMENT',
  SUSPICIONS_ATTACHMENT: 'SUSPICIONS_ATTACHMENT',
};

export const SENDBIRD_MESSAGE_TYPE = {
  MESG: 'MESG',
};

export enum SYSTEM_MESSAGE_TYPE {
  MEETING_COUNT_DOWN_10_MIN = 'MEETING_COUNT_DOWN_10_MIN',
  MEETING_COUNT_DOWN_5_MIN = 'MEETING_COUNT_DOWN_5_MIN',
  MEETING_END = 'MEETING_END',
  MEETING_EXTENDED = 'MEETING_EXTENDED',
  SWITCH_TO_ZOOM = 'SWITCH_TO_ZOOM',
  ZOOM_REJECTED = 'ZOOM_REJECTED'
}

export const SYSTEM_MESSAGE = {
  MEETING_COUNT_DOWN_10_MIN: 'MEETING_COUNT_DOWN_10_MIN',
  MEETING_COUNT_DOWN_5_MIN: 'MEETING_COUNT_DOWN_5_MIN',
  MEETING_END: 'MEETING_END',
  MEETING_EXTENDED: 'MEETING_EXTENDED',
  SWITCH_TO_ZOOM: 'SWITCH_TO_ZOOM',
  ZOOM_REJECTED: 'ZOOM_REJECTED'
};

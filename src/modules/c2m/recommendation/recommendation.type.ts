export enum InterestedStatus {
  PENDING = 0,
  INTERESTED = 1,
  NOT_INTERESTED = 2
}

export enum ReadStatus {
  NOT_READ = 0,
  READ = 1
}

export enum EmailStatus {
  NOT_SEND = 0,
  SENT_BUT_FAIL = 1,
  SENT_SUCCESS = 2
}

export enum NotificationStatus {
  NOT_SEND = 0,
  SENT_BUT_FAIL = 1,
  SENT_SUCCESS = 2
}

export enum TargetType {
  EXHIBITOR = 0,
  PRODUCT = 1
}

export enum PublishType {
  internal = 'internal',
  external = 'external'
}
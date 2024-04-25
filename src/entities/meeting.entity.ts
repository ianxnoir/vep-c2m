import moment from 'moment-timezone';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, AfterLoad, OneToMany, JoinColumn } from 'typeorm';
import { Buyer, Exhibitor } from '../dto/ssoUser.dto';
import {
  EmailDeliveryStatus,
  JoinMeetingStatus,
  MeetingStatus,
  MEETING_READY_BEFORE,
  OnlineMeetingStatus,
  ResponseStatus,
} from '../modules/c2m/meeting/meeting.type';
import { NotificationEntity } from './notification.entity';

@Entity({
  name: 'vepC2MMeeting',
  schema: 'vep_c2m_service_db',
})
export class Meeting {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({ nullable: true, unique: true })
  public meetingId!: string;

  @Column()
  public fairCode!: string;

  @Column()
  public fiscalYear!: string;

  @Column()
  public name!: string;

  @Column()
  public message!: string;

  @Column()
  public type!: number;

  @Column()
  public f2fLocation!: string;

  @Column({ nullable: true, default: null })
  public requesterFirstName!: string;

  @Column({ nullable: true, default: null })
  public requesterLastName!: string;

  @Column()
  public assignerId!: string;

  @Column()
  public assignerRole!: string;

  @Column()
  public requesterSsoUid!: string;

  @Column()
  public requesterRole!: string;

  @Column({ default: 0 })
  public isRequesterJoined!: JoinMeetingStatus;

  @Column({ default: ResponseStatus.PENDING })
  public requesterResponseStatus!: ResponseStatus;

  @Column({ default: EmailDeliveryStatus.PENDING })
  public requesterEmailStatus!: EmailDeliveryStatus;

  @Column({ nullable: true, default: null })
  public responderFirstName!: string;

  @Column({ nullable: true, default: null })
  public responderLastName!: string;

  @Column()
  public responderSsoUid!: string;

  @Column()
  public responderRole!: string;

  @Column()
  public requesterCompanyName!: string;

  @Column({ nullable: true, default: null })
  public requesterSupplierUrn!: string;

  @Column({ nullable: true, default: null })
  public requesterExhibitorUrn!: string;

  @Column()
  public requesterCountryCode!: string;

  @Column()
  public requesterCompanyLogo!: string;

  @Column()
  public responderCompanyName!: string;

  @Column({ nullable: true, default: null })
  public responderSupplierUrn!: string;

  @Column({ nullable: true, default: null })
  public responderExhibitorUrn!: string;

  @Column()
  public responderCountryCode!: string;

  @Column({ nullable: true, default: null })
  public responderFairCode!: string;

  @Column()
  public responderCompanyLogo!: string;

  @Column({ default: 0 })
  public isResponderJoined!: JoinMeetingStatus;

  @Column({ default: ResponseStatus.PENDING })
  public responderResponseStatus!: ResponseStatus;

  @Column({ default: EmailDeliveryStatus.PENDING })
  public responderEmailStatus!: EmailDeliveryStatus;

  @Column()
  public responderFiscalYear!: string;

  @Column()
  public scoreToBuyer!: number;

  @Column()
  public scoreToBuyerRefTxt!: string;

  @Column()
  public scoreToExhibitor!: number;

  @Column()
  public scoreToExhibitorRefTxt!: string;

  @Column({ default: 0 })
  public status!: number;

  @Column()
  public startTime!: Date;

  @Column()
  public endTime!: Date;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  public zoomId!: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  public zoomStartUrl!: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  public zoomJoinUrl!: string | null;

  @Column({ default: null })
  public rescheduledTo!: number;

  @Column()
  public rescheduledTime!: number;

  @Column()
  public cancelledBy!: string;

  @Column()
  public cancelledByRole!: string;

  @Column({ type: 'varchar', nullable: true })
  public tdcCancelBy!: string;

  @Column()
  public cancelledReason!: string;

  @Column({ type: 'bool', default: false })
  public isExtended!: boolean;

  @Column({ type: 'bool', default: false })
  public isRefusedExtend!: boolean;

  @Column()
  public liveStatus!: number;

  @Column()
  public createdBy!: string;

  @CreateDateColumn()
  public creationTime!: Date;

  @Column()
  public lastUpdatedBy!: string;

  @UpdateDateColumn()
  public lastUpdatedAt!: Date;

  @DeleteDateColumn()
  public deletionTime!: Date;

  public isOngoing: boolean = false;

  public isCollided: boolean = false;

  public canAccept: boolean = false;

  public collisionMeetings?: Meeting[];

  public isCollidedWithEvent: boolean = false;

  public isEditable: boolean = false;

  // Mock data
  public fairThemeColor: string = '#108548';

  public requester: Buyer | Exhibitor | null = null;

  public responder: Buyer | Exhibitor | null = null;

  public onlineMeetingStatus: OnlineMeetingStatus | null = null;

  @OneToMany(() => NotificationEntity, (notification) => notification.meetingId)
  @JoinColumn({ name: 'notification' })
  public notification!: NotificationEntity[];

  @AfterLoad()
  public setComputed(): void {
    const isOngoing = this.status === MeetingStatus.ACCEPTED && moment().isAfter(moment(this.startTime)) && moment().isBefore(moment(this.endTime));
    this.isOngoing = isOngoing;

    this.isEditable = !(moment(this.startTime).subtract(MEETING_READY_BEFORE, 'm').isBefore() && moment().isBefore(this.endTime) && this.status === 1);
  }

  public getRequesterFullName(): string {
    return `${this.requester?.firstName || ''} ${this.requester?.lastName || ''}`;
  }

  public getRequesterCompanyName(): string {
    return this.requester?.companyName || '';
  }

  public getResponderFullName(): string {
    return `${this.responder?.firstName || ''} ${this.responder?.lastName || ''}`;
  }

  public getResponderCompanyName(): string {
    return this.responder?.companyName || '';
  }
}

import { IsNotEmpty } from 'class-validator';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ChannelType, NotificationType, ReceiverRole } from '../modules/c2m/notification/notification.type';
import { Meeting } from './meeting.entity';

@Entity({
  name: 'vepC2MNotification',
  schema: 'vep_c2m_service_db',
})
export class NotificationEntity {
  @PrimaryGeneratedColumn()
  public id!: number;

  @IsNotEmpty()
  @ManyToOne(() => Meeting)
  @JoinColumn([{ name: 'meetingId', referencedColumnName: 'id' }])
  public meetingId!: number;

  @Column()
  public refUserId!: string;

  @Column()
  public refFairCode!: string;

  @Column()
  public refFiscalYear!: string;

  @Column()
  @IsNotEmpty()
  public templateId!: number;

  @Column()
  @IsNotEmpty()
  public channelType!: ChannelType;

  @Column()
  @IsNotEmpty()
  public notificationType!: NotificationType;

  @Column()
  @IsNotEmpty()
  public receiverRole!: ReceiverRole;

  @Column()
  public notificationContent!: string;

  @Column()
  public sqsResponse!: string;

  // 0, 1 success, 2 fail
  @Column()
  @IsNotEmpty()
  public status!: number;

  @Column()
  @IsNotEmpty()
  public retryCount!: number;

  @CreateDateColumn()
  @IsNotEmpty()
  public creationTime!: Date;

  @UpdateDateColumn()
  @IsNotEmpty()
  public lastUpdatedAt!: Date;

  @ManyToOne(() => Meeting)
  @JoinColumn({ name: 'meetingId' })
  public meeting!: Meeting;
}

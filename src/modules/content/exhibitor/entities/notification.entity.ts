import { IsNotEmpty } from 'class-validator';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn,UpdateDateColumn } from 'typeorm';
import { ChannelType, NotificationType, ReceiverRole } from '../../../c2m/notification/notification.type';

@Entity({ name: 'vepC2MNotification', schema: 'vepExhibitorDb', database: 'vepExhibitorDb' })
export class ExhibitorNotificationEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  public meetingId!: number;

  @Column()
  refUserId!: string;

  @Column()
  refEoaFairId!: string;

  @Column()
  @IsNotEmpty()
  templateId!: string;

  @Column()
  @IsNotEmpty()
  channelType!: ChannelType;

  @Column()
  @IsNotEmpty()
  notificationType!: NotificationType;

  @Column()
  @IsNotEmpty()
  receiverRole!: ReceiverRole;

  @Column()
  notificationContent!: string;

  @Column()
  sqsResponse!: string;

  // 0, 1 success, 2 fail
  @Column()
  @IsNotEmpty()
  status!: number;
  
  @Column()
  @IsNotEmpty()
  retryCount!: number;
  
  @CreateDateColumn()
  @IsNotEmpty()
  creationTime!: Date;

  @UpdateDateColumn()
  @IsNotEmpty()
  lastUpdatedAt!: Date;

}

import { IsNotEmpty } from 'class-validator';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ChannelType, NotificationType, ReceiverRole } from '../../../c2m/notification/notification.type';

@Entity({ name: 'vepC2MNotification', schema: 'vepFairDb', database: 'vepFairDb' })
export class BuyerNotificationEntity {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
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
}

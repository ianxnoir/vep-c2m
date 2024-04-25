import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { EmailStatus, NotificationStatus, PublishType, ReadStatus } from '../modules/c2m/recommendation/recommendation.type';

@Entity({
  // name: 'vepC2MRecommendationDevelopment',
  name: 'vepC2MBMRecommendation',
  schema: 'vep_c2m_service_db',
})
export class Recommendation {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public ssoUid!: string;

  @Column()
  public sentTime!: Date;

  @Column({ default: PublishType.internal })
  public publishType!: string;

  @Column({ default: ReadStatus.NOT_READ })
  public readStatus!: number;

  @Column({ default: EmailStatus.NOT_SEND })
  public emailStatus!: number;

  @Column({ default: NotificationStatus.NOT_SEND })
  public notificationStatus!: number;

  @Column()
  public fairCode!: string;

  @Column()
  public fairYear!: string;

  @Column({ nullable: true, default: null })
  public bmMessage!: string;

  @Column()
  public createdBy!: string;

  @CreateDateColumn({ type: 'datetime', default: new Date() })
  public creationTime!: Date;

  @Column()
  public lastUpdatedBy!: string;

  @UpdateDateColumn({ type: 'datetime', default: new Date() })
  public lastUpdatedAt!: Date;

  @Column({ type: 'datetime', nullable: true, default: null })
  public deletionTime!: Date | null;
}

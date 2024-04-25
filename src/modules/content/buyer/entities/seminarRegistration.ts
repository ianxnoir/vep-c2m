import { Entity, Column, PrimaryGeneratedColumn, } from 'typeorm';
import { seminarType, sourceType, userType } from '../../../c2m/notification/notification.type';

@Entity({
  name: 'vepFairSeminarRegistration',
})
export class Registration {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({ type: 'varchar', nullable: false })
  public fairCode!: string;

  @Column({ type: 'varchar', nullable: false })
  public fiscalYear!: string;

  @Column('enum', { enum: seminarType, nullable: false })
  public seminarRegistrationType!: seminarType;

  @Column({ type: 'varchar', nullable: false })
  public eventId!: string;

  @Column({ type: 'varchar', nullable: false })
  public seminarId!: string;

  @Column('enum', { enum: userType, nullable: false })
  public userRole!: userType;

  @Column({ type: 'varchar', nullable: false })
  public userId!: string;

  @Column({ type: 'varchar', nullable: false })
  public systemCode!: string;

  @Column({ type: 'varchar', nullable: true })
  public paymentSession!: string | null;

  @Column({ type: 'varchar', nullable: true })
  public isCheckedOption1!: string | null;

  @Column({ type: 'varchar', nullable: true })
  public isCheckedOption2!: string | null;

  @Column({ type: 'varchar', nullable: true })
  public isCheckedOption3!: string | null;

  @Column({ type: 'varchar', nullable: true })
  public option1Question!: string | null;

  @Column({ type: 'varchar', nullable: true })
  public option2Question!: string | null;

  @Column({ type: 'varchar', nullable: true })
  public option3Question!: string | null;

  @Column({ type: 'varchar', nullable: true })
  public option1Ans!: string | null;

  @Column({ type: 'varchar', nullable: true })
  public option2Ans!: string | null;

  @Column({ type: 'varchar', nullable: true })
  public option3Ans!: string | null;

  @Column({ type: 'varchar', nullable: false })
  public seminarRegStatus!: string;

  @Column({ type: 'varchar', nullable: false })
  public shouldSendConfirmationEmail!: string;

  @Column({ type: 'numeric' })
  public emailNotiStatus!: number | null;

  @Column({ type: 'numeric' })
  public webNotiStatus!: number | null;

  @Column({ type: 'numeric' })
  public watchNowStatus!: number | null;

  @Column({ type: 'numeric' })
  public playBackStatus!: number | null;

  @Column('enum', { enum: sourceType, nullable: false })
  public source!: sourceType;

  @Column({ nullable: false })
  public createdBy!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public creationTime!: Date;

  @Column({ nullable: false })
  public lastUpdatedBy!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public lastUpdatedTime!: Date;
}

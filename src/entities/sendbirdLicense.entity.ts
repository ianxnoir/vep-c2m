import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { SendbirdLicenseOptionalInterface, SendbirdLicenseMustInterface } from '../dto/sendbirdLicense.dto';
import { Meeting } from './meeting.entity';

@Entity({
  name: 'vepSendbirdLicense',
  schema: 'vep_c2m_service_db',
})
export class SendbirdLicense implements SendbirdLicenseOptionalInterface, SendbirdLicenseMustInterface {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({ name: "meetingId" })
  public meetingId!: string;

  @Column({ name: "userId" })
  public userId!: string;

  @Column({ name: "referenceKey" })
  public referenceKey!: string;

  @Column({ name: "status" })
  public status!: number;

  @CreateDateColumn({ name: "creationTime", default: new Date() })
  public creationTime!: Date;

  @UpdateDateColumn({ name: "lastUpdatedAt", default: new Date() })
  public lastUpdatedAt!: Date;

  @ManyToOne(() => Meeting, (Meeting) => Meeting.id)
  @JoinColumn({ name: "id" })
  public meetingData!: Meeting[];
}

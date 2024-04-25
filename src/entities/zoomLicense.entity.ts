import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { ZOOMLicenseOptionalInterface, ZOOMLicenseMustInterface } from '../dto/zoomLicense.dto';
import { Meeting } from './meeting.entity';

@Entity({
  name: 'vepZOOMLicense',
  schema: 'vep_c2m_service_db',
})
export class ZOOMLicense implements ZOOMLicenseOptionalInterface, ZOOMLicenseMustInterface {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({ name: "meetingId", unique: true, nullable: true })
  public meetingId!: string;

  @Column({ name: "accountEmail" })
  public accountEmail!: string;

  @CreateDateColumn({ name: "creationTime", default: new Date() })
  public creationTime!: Date;

  @UpdateDateColumn({ name: "lastUpdatedAt", default: new Date() })
  public lastUpdatedAt!: Date;

  @ManyToOne(() => Meeting, (Meeting) => Meeting.id)
  @JoinColumn({ name: "id" })
  public meetingData!: Meeting[];
}

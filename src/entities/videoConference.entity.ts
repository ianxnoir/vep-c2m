import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../modules/c2m/videoConference/videoConference.type';
import { Meeting } from './meeting.entity';

@Entity({
  name: 'vepC2MVideoConference',
  schema: 'vep_c2m_service_db',
})
export class VideoConference {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public meetingId!: string;

  @OneToOne(() => Meeting)
  @JoinColumn({ name: 'meetingId' })
  public meeting!: Meeting;

  @ManyToOne(() => Meeting)
  @JoinColumn({ name: 'meetingId', referencedColumnName: 'meetingId' })
  public meetingOfVideoConference!: Meeting;

  @Column()
  public connectionId!: string;

  @Column()
  public ssoUid!: string;

  @Column()
  public role!: Role;

  @Column()
  public displayName!: string;

  @Column()
  public displayCompany!: string;

  @Column()
  public companyRole!: string;

  @Column()
  public country!: string;

  @Column({ type: 'bool', default: false })
  public isAdmitted!: boolean;

  @Column({ type: 'bool', default: false })
  public isKicked!: boolean;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  public joinedAt!: Date | null;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  public disconnectedAt!: Date | null;
}

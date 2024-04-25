import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('fairParticipant', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairParticipant extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'ssoUid', nullable: true, length: 50 })
  ssoUid!: string | null;

  @Column('varchar', { name: 'emailId', nullable: true, length: 255 })
  emailId!: string | null;

  @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.fairParticipant)
  fairRegistrations!: FairRegistration[];
}

import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('fairParticipantType', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairParticipantType extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', {
    name: 'fairParticipantTypeCode',
    nullable: true,
    length: 255,
  })
  fairParticipantTypeCode!: string | null;

  @Column('varchar', {
    name: 'fairParticipantTypeDesc',
    nullable: true,
    length: 255,
  })
  fairParticipantTypeDesc!: string | null;

  @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.fairParticipantType)
  fairRegistrations!: FairRegistration[];
}

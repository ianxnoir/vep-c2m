import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('c2mParticipantStatus', { schema: 'vepFairDb', database: 'vepFairDb' })
export class C2mParticipantStatus extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', {
    name: 'c2mParticipantStatusCode',
    nullable: true,
    length: 255,
  })
  c2mParticipantStatusCode!: string | null;

  @Column('varchar', {
    name: 'c2mParticipantStatusDesc',
    nullable: true,
    length: 255,
  })
  c2mParticipantStatusDesc!: string | null;

  @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.c2mParticipantStatus)
  fairRegistrations!: FairRegistration[];

  @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.formTemplate)
  fairRegistrations2!: FairRegistration[];
}

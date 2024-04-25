import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('fairRegistrationStatus', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistrationStatus extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', {
    name: 'fairRegistrationStatusCode',
    nullable: true,
    length: 255,
  })
  fairRegistrationStatusCode!: string | null;

  @Column('varchar', {
    name: 'fairRegistrationStatusDesc',
    nullable: true,
    length: 255,
  })
  fairRegistrationStatusDesc!: string | null;

  @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.fairRegistrationStatus)
  fairRegistrations!: FairRegistration[];
}

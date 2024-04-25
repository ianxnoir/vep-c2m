import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('fairRegistrationType', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistrationType extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', {
    name: 'fairRegistrationTypeCode',
    nullable: true,
    length: 36,
  })
  fairRegistrationTypeCode!: string | null;

  @Column('varchar', {
    name: 'fairRegistrationTypeDesc',
    nullable: true,
    length: 255,
  })
  fairRegistrationTypeDesc!: string | null;

  @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.fairRegistrationType)
  fairRegistrations!: FairRegistration[];
}

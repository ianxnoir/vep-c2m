import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Index('fairRegistrationId', ['fairRegistrationId'], {})
@Entity('fairRegistrationProductInterest', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistrationProductInterest extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('bigint', { name: 'fairRegistrationId', unsigned: true })
  fairRegistrationId!: string;

  @Column('varchar', { name: 'stId', length: 40 })
  stId!: string;

  @Column('varchar', { name: 'iaId', length: 40 })
  iaId!: string;

  @Column('varchar', { name: 'teCode', length: 40 })
  teCode!: string;

  @ManyToOne(() => FairRegistration, (fairRegistration) => fairRegistration.fairRegistrationProductInterests, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'fairRegistrationId', referencedColumnName: 'id' }])
  fairRegistration!: FairRegistration;
}

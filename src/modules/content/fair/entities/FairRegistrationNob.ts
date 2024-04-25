import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Index('fairRegistrationId', ['fairRegistrationId'], {})
@Entity('fairRegistrationNob', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistrationNob extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('bigint', { name: 'fairRegistrationId', unsigned: true })
  fairRegistrationId!: string;

  @Column('varchar', { name: 'fairRegistrationNobCode', length: 20 })
  fairRegistrationNobCode!: string;

  @ManyToOne(() => FairRegistration, (fairRegistration) => fairRegistration.fairRegistrationNobs, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'fairRegistrationId', referencedColumnName: 'id' }])
  fairRegistration!: FairRegistration;
}

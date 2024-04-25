import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Index('fairRegistrationId', ['fairRegistrationId'], {})
@Entity('fairRegistrationProductStrategy', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistrationProductStrategy extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('bigint', { name: 'fairRegistrationId', unsigned: true })
  fairRegistrationId!: string;

  @Column('varchar', {
    name: 'fairRegistrationProductStrategyCode',
    length: 20,
  })
  fairRegistrationProductStrategyCode!: string;

  @ManyToOne(() => FairRegistration, (fairRegistration) => fairRegistration.fairRegistrationProductStrategies, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'fairRegistrationId', referencedColumnName: 'id' }])
  fairRegistration!: FairRegistration;
}

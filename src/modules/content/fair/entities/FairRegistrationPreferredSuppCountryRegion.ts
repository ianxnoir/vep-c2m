import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Index('fairRegistrationId', ['fairRegistrationId'], {})
@Entity('fairRegistrationPreferredSuppCountryRegion', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistrationPreferredSuppCountryRegion extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('bigint', { name: 'fairRegistrationId', unsigned: true })
  fairRegistrationId!: string;

  @Column('varchar', {
    name: 'fairRegistrationPreferredSuppCountryRegionCode',
    length: 20,
  })
  fairRegistrationPreferredSuppCountryRegionCode!: string;

  @ManyToOne(() => FairRegistration, (fairRegistration) => fairRegistration.fairRegistrationPreferredSuppCountryRegions, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([{ name: 'fairRegistrationId', referencedColumnName: 'id' }])
  fairRegistration!: FairRegistration;
}

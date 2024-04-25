import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Index('fairRegistrationId', ['fairRegistrationId'], {})
@Entity('fairRegistrationTypesOfTargetSuppliers', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistrationTypesOfTargetSuppliers extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('bigint', { name: 'fairRegistrationId', unsigned: true })
  fairRegistrationId!: string;

  @Column('varchar', {
    name: 'fairRegistrationTypesOfTargetSuppliersCode',
    length: 20,
  })
  fairRegistrationTypesOfTargetSuppliersCode!: string;

  @ManyToOne(() => FairRegistration, (fairRegistration) => fairRegistration.fairRegistrationTypesOfTargetSuppliers, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([{ name: 'fairRegistrationId', referencedColumnName: 'id' }])
  fairRegistration!: FairRegistration;
}

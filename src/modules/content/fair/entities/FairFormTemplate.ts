import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('fairFormTemplate', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairFormTemplate extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', {
    name: 'fairFormTemplateCode',
    nullable: true,
    length: 255,
  })
  fairFormTemplateCode!: string | null;

  @Column('varchar', {
    name: 'fairFormTemplateType',
    nullable: true,
    length: 20,
  })
  fairFormTemplateType!: string | null;

  @Column('blob', { name: 'fairFormTemplateJson', nullable: true })
  fairFormTemplateJson!: Buffer | null;

  @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.formTemplate)
  fairRegistrations!: FairRegistration[];
}

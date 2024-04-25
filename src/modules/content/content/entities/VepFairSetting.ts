import { Column, Entity } from 'typeorm';
// import { FairRegistration } from '../../fair/entities/FairRegistration';

@Entity('vep_fair_setting', { schema: 'vep_content', database: 'vep_content' })
export class VepFairSetting {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'faircode', nullable: true, length: 255 })
  faircode!: string | null;

  @Column('varchar', { name: 'meta_key', nullable: true, length: 255 })
  metaKey!: string | null;

  @Column('longtext', { name: 'meta_value', nullable: true })
  metaValue!: string | null;

  @Column('varchar', { name: 'fiscal_year', nullable: true, length: 255 })
  fiscalYear!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;

  // @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.fairSetting)
  // fairRegistrations!: FairRegistration[];
}

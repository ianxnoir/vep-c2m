import { Column, Entity } from 'typeorm';

@Entity('vep_council_global_office', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalOffice {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'office_code', nullable: true })
  officeCode!: string | null;

  @Column('text', { name: 'office_desc_en', nullable: true })
  officeDescEn!: string | null;

  @Column('text', { name: 'office_desc_tc', nullable: true })
  officeDescTc!: string | null;

  @Column('text', { name: 'office_desc_sc', nullable: true })
  officeDescSc!: string | null;

  @Column('text', { name: 'office_type', nullable: true })
  officeType!: string | null;

  @Column('text', { name: 'office_type_desc', nullable: true })
  officeTypeDesc!: string | null;

  @Column('text', { name: 'record_owner_office', nullable: true })
  recordOwnerOffice!: string | null;

  @Column('text', { name: 'email', nullable: true })
  email!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;
}

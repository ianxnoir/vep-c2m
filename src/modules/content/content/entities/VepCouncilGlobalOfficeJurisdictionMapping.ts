import { Column, Entity } from 'typeorm';

@Entity('vep_council_global_office_jurisdiction_mapping', {
  schema: 'vep_content',
})
export class VepCouncilGlobalOfficeJurisdictionMapping {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'office_cd', nullable: true })
  officeCd!: string | null;

  @Column('text', { name: 'description', nullable: true })
  description!: string | null;

  @Column('text', { name: 'country_cd', nullable: true })
  countryCd!: string | null;

  @Column('text', { name: 'description_1', nullable: true })
  description_1!: string | null;

  @Column('text', { name: 'loc1_cd', nullable: true })
  loc1Cd!: string | null;

  @Column('text', { name: 'loc1_description', nullable: true })
  loc1Description!: string | null;

  @Column('text', { name: 'loc2_cd', nullable: true })
  loc2Cd!: string | null;

  @Column('text', { name: 'loc2_description', nullable: true })
  loc2Description!: string | null;

  @Column('text', { name: 'loc3_cd', nullable: true })
  loc3Cd!: string | null;

  @Column('text', { name: 'loc3_description', nullable: true })
  loc3Description!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;
}

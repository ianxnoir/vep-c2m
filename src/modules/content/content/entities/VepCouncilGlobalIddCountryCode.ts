import { Column, Entity } from 'typeorm';

@Entity('vep_council_global_idd_country_code', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalIddCountryCode {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'country_code', nullable: true })
  countryCode!: string | null;

  @Column('text', { name: 'country_description', nullable: true })
  countryDescription!: string | null;

  @Column('text', { name: 'chinese_description_tc', nullable: true })
  chineseDescriptionTc!: string | null;

  @Column('text', { name: 'chinese_description_sc', nullable: true })
  chineseDescriptionSc!: string | null;

  @Column('text', { name: 'tel_country_code', nullable: true })
  telCountryCode!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;
}

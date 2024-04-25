import { Column, Entity } from 'typeorm';

@Entity('vep_council_global_region_country_mapping', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalRegionCountryMapping {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'createdBy', nullable: true, length: 255 })
  createdBy!: string | null;

  @Column('timestamp', {
    name: 'creationTime',
    default: () => "'current_timestamp(6)'",
  })
  creationTime!: Date;

  @Column('varchar', { name: 'lastUpdatedBy', nullable: true, length: 255 })
  lastUpdatedBy!: string | null;

  @Column('timestamp', {
    name: 'lastUpdatedTime',
    default: () => "'0000-00-00 00:00:00.000000'",
  })
  lastUpdatedTime!: Date;

  @Column('timestamp', {
    name: 'deletionTime',
    default: () => "'0000-00-00 00:00:00.000000'",
  })
  deletionTime!: Date;

  @Column('varchar', { name: 'region_cd', nullable: true, length: 30 })
  regionCd!: string | null;

  @Column('varchar', {
    name: 'region_description',
    nullable: true,
    length: 255,
  })
  regionDescription!: string | null;

  @Column('varchar', { name: 'country_code', nullable: true, length: 30 })
  countryCode!: string | null;

  @Column('varchar', {
    name: 'country_description',
    nullable: true,
    length: 255,
  })
  countryDescription!: string | null;

  @Column('varchar', {
    name: 'chinese_description_tc',
    nullable: true,
    length: 255,
  })
  chineseDescriptionTc!: string | null;

  @Column('varchar', {
    name: 'chinese_description_sc',
    nullable: true,
    length: 255,
  })
  chineseDescriptionSc!: string | null;
}

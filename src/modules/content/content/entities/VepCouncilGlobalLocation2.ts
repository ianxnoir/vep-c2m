import { Column, Entity, OneToOne, JoinColumn } from 'typeorm';
import { VepCouncilGlobalCityList } from './VepCouncilGlobalCityList';

@Entity('vep_council_global_location2', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalLocation2 {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'country_code', nullable: true })
  countryCode!: string | null;

  @Column('text', { name: 'country_english_description', nullable: true })
  countryEnglishDescription!: string | null;

  @Column('text', { name: 'country_chinese_description_tc', nullable: true })
  countryChineseDescriptionTc!: string | null;

  @Column('text', { name: 'country_chinese_description_sc', nullable: true })
  countryChineseDescriptionSc!: string | null;

  @Column('text', { name: 'location_1_code', nullable: true })
  location_1Code!: string | null;

  //@Column("text", { name: "english_description", nullable: true })
  //englishDescription: string | null;
  //
  //@Column("text", { name: "chinese_description_tc", nullable: true })
  //chineseDescriptionTc: string | null;
  //
  //@Column("text", { name: "chinese_description_sc", nullable: true })
  //chineseDescriptionSc: string | null;

  @Column('text', { name: 'location_2_code', nullable: true })
  location_2Code!: string | null;

  @Column('text', {
    name: 'location_2_code_english_description',
    nullable: true,
  })
  location_2CodeEnglishDescription!: string | null;

  @Column('text', {
    name: 'location_2_code_chinese_description_tc',
    nullable: true,
  })
  location_2CodeChineseDescriptionTc!: string | null;

  @Column('text', {
    name: 'location_2_code_chinese_description_sc',
    nullable: true,
  })
  location_2CodeChineseDescriptionSc!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;

  @OneToOne(() => VepCouncilGlobalCityList)
  @JoinColumn([
    { name: 'location_2_code', referencedColumnName: 'citySymbol' },
    { name: 'location_1_code', referencedColumnName: 'provinceSymbol' },
  ])
  citySid!: VepCouncilGlobalCityList;
}

import { Column, Entity, OneToOne, JoinColumn } from 'typeorm';
// import { VepCouncilGlobalCountry } from './VepCouncilGlobalCountry';
import { VepCouncilGlobalNobProvinceList } from './VepCouncilGlobalNobProvinceList';

@Entity('vep_council_global_country_list', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalCountryList {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'symbol', nullable: true })
  symbol!: string | null;

  @Column('text', { name: 'sid', nullable: true })
  sid!: string | null;

  @Column('text', { name: 'description', nullable: true })
  descEn!: string | null;

  @Column('text', { name: 'tel_code', nullable: true })
  telCode!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;

  @OneToOne(() => VepCouncilGlobalNobProvinceList)
  @JoinColumn([{ name: 'symbol', referencedColumnName: 'countrySymbol' }])
  provinceSid!: VepCouncilGlobalNobProvinceList;

  // @OneToOne(() => VepCouncilGlobalCountry, (country) => country.countrySid)
  // country!: VepCouncilGlobalCountry;
}

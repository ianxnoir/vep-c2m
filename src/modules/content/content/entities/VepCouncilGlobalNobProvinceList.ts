import { Column, Entity, OneToOne, JoinColumn } from 'typeorm';
import { VepCouncilGlobalLocation1 } from './VepCouncilGlobalLocation1';
import { VepCouncilGlobalCountryList } from './VepCouncilGlobalCountryList';

@Entity('vep_council_global_nob_province_list', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalNobProvinceList {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'country_symbol', nullable: true })
  countrySymbol!: string | null;

  @Column('text', { name: 'symbol', nullable: true })
  provinceSymbol!: string | null;

  @Column('text', { name: 'sid', nullable: true })
  sid!: string | null;

  @Column('text', { name: 'description', nullable: true })
  descEn!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;

  @OneToOne(() => VepCouncilGlobalLocation1)
  @JoinColumn([
    { name: 'country_symbol', referencedColumnName: 'c1' },
    { name: 'symbol', referencedColumnName: 'loc1Cd' },
  ])
  province!: VepCouncilGlobalLocation1;

  @OneToOne(() => VepCouncilGlobalCountryList, (countrySid) => countrySid.provinceSid)
  countrySid!: VepCouncilGlobalCountryList;
}

import { Column, Entity, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { VepCouncilGlobalLocation2 } from './VepCouncilGlobalLocation2';
import { VepCouncilGlobalNobProvinceList } from './VepCouncilGlobalNobProvinceList';

@Entity('vep_council_global_city_list', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalCityList {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'sid', nullable: true })
  sid!: string | null;

  @Column('text', { name: 'symbol', nullable: true })
  citySymbol!: string | null;

  @Column('text', { name: 'description', nullable: true })
  description!: string | null;

  @Column('text', { name: 'province_symbol', nullable: true })
  provinceSymbol!: string | null;
  //
  //@Column("text", { name: "province_sid", nullable: true })
  //provinceSid: string | null;
  //
  //@Column("text", { name: "province_desc_en", nullable: true })
  //provinceDescEn: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;

  @OneToOne(() => VepCouncilGlobalLocation2, (city) => city.citySid)
  city!: VepCouncilGlobalLocation2;

  @ManyToOne(() => VepCouncilGlobalNobProvinceList)
  @JoinColumn([{ name: 'province_symbol', referencedColumnName: 'provinceSymbol' }])
  provinceSid!: VepCouncilGlobalNobProvinceList;
}

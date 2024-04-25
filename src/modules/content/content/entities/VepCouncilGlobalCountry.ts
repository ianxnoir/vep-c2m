import { Column, Entity } from 'typeorm';
// import { FairRegistration } from '../../fair/entities/FairRegistration';
// import { VepCouncilGlobalCountryList } from './VepCouncilGlobalCountryList';

@Entity('vep_council_global_country', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalCountry {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  //@Column("text", { name: "code", nullable: true })
  @Column('varchar', { name: 'code', nullable: true })
  code!: string | null;

  @Column('text', { name: 'english_description', nullable: true })
  englishDescription!: string | null;

  @Column('text', { name: 'chinese_description_tc', nullable: true })
  chineseDescriptionTc!: string | null;

  @Column('text', { name: 'chinese_description_sc', nullable: true })
  chineseDescriptionSc!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;

  // @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.addressCountry)
  // fairRegistrations!: FairRegistration[];

  // @OneToOne(() => VepCouncilGlobalCountryList)
  // @JoinColumn([{ name: 'code', referencedColumnName: 'symbol' }])
  // countrySid!: VepCouncilGlobalCountryList;
}

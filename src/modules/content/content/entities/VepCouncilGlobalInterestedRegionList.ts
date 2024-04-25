import { Column, Entity } from 'typeorm';

@Entity('vep_council_global_interested_region_list', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalInterestedRegionList {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'interested_region_symbol', nullable: true })
  interestedRegionSymbol!: string | null;

  @Column('text', { name: 'sid', nullable: true })
  sid!: string | null;

  @Column('text', { name: 'desc_en', nullable: true })
  descEn!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;
}

import { Column, Entity, OneToOne, JoinColumn } from 'typeorm';
import { VepCouncilGlobalNob } from './VepCouncilGlobalNob';

@Entity('vep_council_global_nob_region_list', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalNobRegionList {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'nob_symbol', nullable: true })
  nobSymbol!: string | null;

  @Column('text', { name: 'sid', nullable: true })
  sid!: string | null;

  @Column('text', { name: 'desc_en', nullable: true })
  descEn!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;

  @OneToOne(() => VepCouncilGlobalNob)
  @JoinColumn([{ name: 'nob_symbol', referencedColumnName: 'code' }])
  nob!: VepCouncilGlobalNob;
}

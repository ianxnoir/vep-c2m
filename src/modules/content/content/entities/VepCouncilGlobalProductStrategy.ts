import { Column, Entity } from 'typeorm';

@Entity('vep_council_global_product_strategy', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalProductStrategy {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'productstrategy_code', nullable: true })
  productstrategyCode!: string | null;

  @Column('text', { name: 'productstrategy_desc_en', nullable: true })
  productstrategyDescEn!: string | null;

  @Column('text', { name: 'productstrategy_desc_tc', nullable: true })
  productstrategyDescTc!: string | null;

  @Column('text', { name: 'productstrategy_desc_sc', nullable: true })
  productstrategyDescSc!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;
}

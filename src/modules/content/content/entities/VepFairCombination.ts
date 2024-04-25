import { Column, Entity } from 'typeorm';

@Entity('vep_fair_combination', { schema: 'vep_content', database: 'vep_content' })
export class VepFairCombination {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('bigint', { name: 'combination_index', nullable: true })
  combinationIndex!: string | null;

  @Column('varchar', { name: 'combination_slug', nullable: true, length: 255 })
  combinationSlug!: string | null;

  @Column('varchar', { name: 'combination_name', nullable: true, length: 255 })
  combinationName!: string | null;

  @Column('varchar', { name: 'faircode', nullable: true, length: 255 })
  faircode!: string | null;
}

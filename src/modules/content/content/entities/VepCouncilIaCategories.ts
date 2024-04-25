import { Column, Entity } from 'typeorm';

@Entity('vep_council_ia_categories', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilIaCategories {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'faircode', nullable: true })
  faircode!: string | null;

  @Column('varchar', { name: 'fiscal_year', nullable: true, length: 255 })
  fiscalYear!: string | null;

  @Column('varchar', { name: 'st_id', nullable: true, length: 32 })
  stId!: string | null;

  @Column('varchar', { name: 'st_en', nullable: true, length: 255 })
  stEn!: string | null;

  @Column('varchar', { name: 'st_sc', nullable: true, length: 255 })
  stSc!: string | null;

  @Column('varchar', { name: 'st_tc', nullable: true, length: 255 })
  stTc!: string | null;

  @Column('varchar', { name: 'ia_id', nullable: true, length: 32 })
  iaId!: string | null;

  @Column('varchar', { name: 'ia_en', nullable: true, length: 255 })
  iaEn!: string | null;

  @Column('varchar', { name: 'ia_sc', nullable: true, length: 255 })
  iaSc!: string | null;

  @Column('varchar', { name: 'ia_tc', nullable: true, length: 255 })
  iaTc!: string | null;

  @Column('varchar', { name: 'te_code', nullable: true, length: 30 })
  teCode!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;
}

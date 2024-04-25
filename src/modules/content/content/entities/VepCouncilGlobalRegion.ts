import { Column, Entity } from 'typeorm';

@Entity('vep_council_global_region', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalRegion {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'code', nullable: true })
  code!: string | null;

  @Column('text', { name: 'english_description', nullable: true })
  englishDescription!: string | null;

  @Column('text', { name: 'chinese_description_tc', nullable: true })
  chineseDescriptionTc!: string | null;

  @Column('text', { name: 'chinese_description_sc', nullable: true })
  chineseDescriptionSc!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;
}

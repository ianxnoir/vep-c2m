import { Column, Entity } from 'typeorm';

@Entity('vep_council_global_salutation', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalSalutation {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'code', nullable: true })
  code!: string | null;

  @Column('text', { name: 'english_description', nullable: true })
  englishDescription!: string | null;

  @Column('text', { name: 'chinese_description_tc', nullable: true })
  chneseDescriptionTc!: string | null;

  @Column('text', { name: 'chinese_description_sc', nullable: true })
  chneseDescriptionSc!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;
}

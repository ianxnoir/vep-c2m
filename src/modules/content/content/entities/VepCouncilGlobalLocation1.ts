import { Column, Entity } from 'typeorm';

@Entity('vep_council_global_location1', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalLocation1 {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'c1', nullable: true })
  c1!: string | null;

  @Column('text', { name: 'c2', nullable: true })
  c2!: string | null;

  @Column('text', { name: 'c3_tc', nullable: true })
  c3Tc!: string | null;

  @Column('text', { name: 'c3_sc', nullable: true })
  c3Sc!: string | null;

  @Column('text', { name: 'loc1_cd', nullable: true })
  loc1Cd!: string | null;

  @Column('text', { name: 'loc1_description', nullable: true })
  loc1Description!: string | null;

  @Column('text', { name: 'loc1_description_tc', nullable: true })
  loc1Description_1Tc!: string | null;

  @Column('text', { name: 'loc1_description_sc', nullable: true })
  loc1Description_1Sc!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;
}

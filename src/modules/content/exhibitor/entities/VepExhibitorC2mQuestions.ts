import { Column, Entity, Index, OneToMany, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { VepExhibitorC2mAnswers } from './VepExhibitorC2mAnswers';
import { VepItem } from './VepItem';
import { VepExhibitor } from './VepExhibitor';

@Index('id', ['id'], { unique: true })
@Entity('vepExhibitorC2mQuestions', { schema: 'vepExhibitorDb', database: 'vepExhibitorDb' })
export class VepExhibitorC2mQuestions extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'companyCcdId', length: 255 })
  companyCcdId!: string;

  @Column('varchar', { name: 'eoaFairId', length: 255 })
  eoaFairId!: string;

  @Column('varchar', { name: 'type', length: 50 })
  type!: string;

  @Column('varchar', { name: 'locale', nullable: true, length: 20 })
  locale!: string | null;

  @Column('varchar', { name: 'question', nullable: true, length: 500 })
  question!: string | null;

  @Column('int', { name: 'ordering', nullable: true })
  ordering!: number | null;

  @OneToMany(() => VepExhibitorC2mAnswers, (vepexhibitorc2manswers) => vepexhibitorc2manswers.vepExhibitorQuestion)
  vepexhibitorc2manswers!: VepExhibitorC2mAnswers[];

  @ManyToOne(() => VepExhibitor)
  @JoinColumn([
    { name: 'companyCcdId', referencedColumnName: 'companyCcdId' },
    { name: 'eoaFairId', referencedColumnName: 'eoaFairId' },
  ])
  vepExhibitor!: VepExhibitor;
}

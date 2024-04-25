import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { VepExhibitorC2mQuestions } from './VepExhibitorC2mQuestions';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Index('vepExhibitorQuestionId', ['vepExhibitorQuestionId'], {})
@Entity('vepExhibitorC2mAnswers', { schema: 'vepExhibitorDb', database: 'vepExhibitorDb' })
export class VepExhibitorC2mAnswers extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('bigint', { name: 'vepExhibitorQuestionId', unsigned: true })
  vepExhibitorQuestionId!: string;

  @Column('varchar', { name: 'answer', nullable: true, length: 4000 })
  answer!: string | null;

  @Column('varchar', { name: 'code', nullable: true, length: 20 })
  code!: string | null;

  @ManyToOne(() => VepExhibitorC2mQuestions, (vepexhibitorc2mquestions) => vepexhibitorc2mquestions.vepexhibitorc2manswers, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([{ name: 'vepExhibitorQuestionId', referencedColumnName: 'id' }])
  vepExhibitorQuestion!: VepExhibitorC2mQuestions;
}

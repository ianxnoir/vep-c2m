import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { VepItem } from './VepItem';
import { VepExhibitor } from './VepExhibitor';

@Index('id', ['id'], { unique: true })
@Entity('vepExhibitorAttributes', { schema: 'vepExhibitorDb', database: 'vepExhibitorDb' })
export class VepExhibitorAttributes extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'companyCcdId', length: 255 })
  companyCcdId!: string;

  @Column('varchar', { name: 'eoaFairId', length: 255 })
  eoaFairId!: string;

  @Column('varchar', { name: 'attribute', length: 255 })
  attribute!: string;

  @Column('varchar', { name: 'code', nullable: true, length: 20 })
  code!: string | null;

  @Column('varchar', { name: 'locale', nullable: true, length: 20 })
  locale!: string | null;

  @Column('varchar', { name: 'value', nullable: true, length: 255 })
  value!: string | null;

  @ManyToOne(() => VepExhibitor)
  @JoinColumn([
    { name: 'companyCcdId', referencedColumnName: 'companyCcdId' },
    { name: 'eoaFairId', referencedColumnName: 'eoaFairId' },
  ])
  vepExhibitor!: VepExhibitor;
}

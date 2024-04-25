import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { VepExhibitor } from './VepExhibitor';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('vepExhibitorRegistrationStatus', { schema: 'vepExhibitorDb', database: 'vepExhibitorDb' })
export class VepExhibitorRegistrationStatus extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', {
    name: 'vepExhibitorRegistrationStatusCode',
    nullable: true,
    length: 255,
  })
  vepExhibitorRegistrationStatusCode!: string | null;

  @Column('varchar', {
    name: 'vepExhibitorRegistrationStatusDesc',
    nullable: true,
    length: 255,
  })
  vepExhibitorRegistrationStatusDesc!: string | null;

  @OneToMany(() => VepExhibitor, (vepExhibitor) => vepExhibitor.vepExhibitorRegistrationStatus)
  vepExhibitors!: VepExhibitor[];
}

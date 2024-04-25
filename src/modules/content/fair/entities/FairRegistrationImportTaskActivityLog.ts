import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('fairRegistrationImportTaskActivityLog', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistrationImportTaskActivityLog extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'taskId', nullable: true, length: 36 })
  taskId!: string | null;

  @Column('varchar', { name: 'activityType', nullable: true, length: 20 })
  activityType!: string | null;

  @Column('varchar', { name: 'value', nullable: true, length: 150 })
  value!: string | null;
}

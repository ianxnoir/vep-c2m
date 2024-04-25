import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('fairRegistrationImportTaskLog', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistrationImportTaskLog extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'taskId', nullable: true, length: 36 })
  taskId!: string | null;

  @Column('varchar', { name: 'rowNumber', nullable: true, length: 10 })
  rowNumber!: string | null;

  @Column('varchar', { name: 'status', nullable: true, length: 20 })
  status!: string | null;

  @Column('varchar', { name: 'message', nullable: true, length: 150 })
  message!: string | null;
}

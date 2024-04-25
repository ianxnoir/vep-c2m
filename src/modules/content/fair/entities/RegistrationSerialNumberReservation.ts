import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('registrationSerialNumberReservation', { schema: 'vepFairDb', database: 'vepFairDb' })
export class RegistrationSerialNumberReservation extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'projectYear', nullable: true, length: 255 })
  projectYear!: string | null;

  @Column('varchar', { name: 'sourceTypeCode', nullable: true, length: 255 })
  sourceTypeCode!: string | null;

  @Column('varchar', { name: 'visitorTypeCode', nullable: true, length: 255 })
  visitorTypeCode!: string | null;

  @Column('varchar', { name: 'projectNumber', nullable: true, length: 255 })
  projectNumber!: string | null;

  @Column('bigint', { name: 'serialNumberStart', unsigned: true })
  serialNumberStart!: string;

  @Column('bigint', { name: 'serialNumberEnd', unsigned: true })
  serialNumberEnd!: string;

  @Column('varchar', { name: 'taskReferenceId', nullable: true, length: 255 })
  taskReferenceId!: string | null;
}

import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('fairRegistrationImportTask', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistrationImportTask extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'taskId', nullable: true, length: 36 })
  taskId!: string | null;

  @Column('varchar', { name: 'originalFileName', nullable: true, length: 150 })
  originalFileName!: string | null;

  @Column('varchar', {
    name: 'uploadFileS3ObjectRefId',
    nullable: true,
    length: 500,
  })
  uploadFileS3ObjectRefId!: string | null;

  @Column('varchar', {
    name: 'failureReportS3ObjectRefId',
    nullable: true,
    length: 500,
  })
  failureReportS3ObjectRefId!: string | null;

  @Column('varchar', { name: 'fairCode', nullable: true, length: 50 })
  fairCode!: string | null;

  @Column('varchar', { name: 'fiscalYear', nullable: true, length: 9 })
  fiscalYear!: string | null;

  @Column('varchar', { name: 'projectYear', nullable: true, length: 9 })
  projectYear!: string | null;

  @Column('varchar', { name: 'actionType', nullable: true, length: 20 })
  actionType!: string | null;

  @Column('varchar', { name: 'sourceType', nullable: true, length: 20 })
  sourceType!: string | null;

  @Column('varchar', { name: 'visitorType', nullable: true, length: 20 })
  visitorType!: string | null;

  @Column('bigint', { name: 'participantTypeId', nullable: true, unsigned: true })
  participantTypeId!: string | null;

  @Column('varchar', { name: 'tier', nullable: true, length: 20 })
  tier!: string | null;

  @Column('mediumint', { name: 'serialNumberStart', nullable: true })
  serialNumberStart!: number | null;

  @Column('mediumint', { name: 'numberOfRow', nullable: true })
  numberOfRow!: number | null;

  @Column('varchar', { name: 'status', nullable: true, length: 20 })
  status!: string | null;
}

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({
  name: 'vepC2MMeetingConfig',
  schema: 'vep_c2m_service_db',
})
export class MeetingConfig {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public fairCode!: string;

  @Column()
  public fairYear!: string;

  @Column()
  public feedbackFormId!: string;

  @Column()
  public createdBy!: string;

  @CreateDateColumn({ type: 'datetime', default: new Date() })
  public creationTime!: Date;

  @Column()
  public lastUpdatedBy!: string;

  @UpdateDateColumn({ type: 'datetime', default: new Date() })
  public lastUpdatedAt!: Date;

  @Column({ type: 'datetime', nullable: true, default: null })
  public deletionTime!: Date | null;
}

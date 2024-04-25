import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({
  name: 'vepC2MUnavailableTimeslot',
  schema: 'vep_c2m_service_db',
  database: 'vep_c2m_service_db',
})
export class UnavailableTimeslot {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public fairCode!: string;

  @Column()
  public ssoUid!: string;

  @Column()
  public startTime!: Date;

  @Column()
  public endTime!: Date;

  @Column()
  public createdBy!: string;

  @CreateDateColumn()
  public creationTime!: Date;

  @Column()
  public lastUpdatedBy!: string;

  @UpdateDateColumn()
  public lastUpdatedAt!: Date;
}

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity({
  name: 'vepC2MHiddenRecord',
  schema: 'vep_c2m_service_db',
  database: 'vep_c2m_service_db',
})
export class HiddenRecord {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public ssoUid!: string;

  @Column()
  public fairCode!: string;

  @Column()
  public fairYear!: string;

  @Column()
  public hiddenTarget!: string;

  @Column()
  public hiddenType!: number;

  @CreateDateColumn()
  public creationTime!: Date;
}

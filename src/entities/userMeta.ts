import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({
  name: 'vepC2MUserMeta',
  schema: 'vep_c2m_service_db',
})
export class UserMeta {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public ssoUid!: string;

  @Column()
  public key!: string;

  @Column()
  public value!: string;

  @CreateDateColumn()
  public creationTime!: Date;

  @UpdateDateColumn()
  public lastUpdatedAt!: Date;
}

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity({
  name: 'vepC2MRecommendation',
  schema: 'vep_c2m_service_db',
  database: 'vep_c2m_service_db',
})
export class Recommendation {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public fairCode!: string;

  @Column()
  public fairYear!: string;

  @Column()
  public ssoUid!: string;

  @Column()
  public targetType!: number;

  @Column()
  public targetId!: string;

  @Column()
  public interestedStatus!: number;

  @Column()
  public readStatus!: number;

  @Column()
  public emailStatus!: number;

  @Column()
  public notificationStatus!: number;

  @Column()
  public sentTime!: Date;

  @Column()
  public createdBy!: string;

  @CreateDateColumn()
  public creationTime!: Date;

  @Column()
  public lastUpdatedBy!: string;
}

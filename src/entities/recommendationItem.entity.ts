import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, JoinColumn, ManyToOne } from 'typeorm';
import { InterestedStatus } from '../modules/c2m/recommendation/recommendation.type';
import { Recommendation } from './recommendation.entity';

@Entity({
  name: 'vepC2MBMRecommendationItem',
  schema: 'vep_c2m_service_db',
})
export class RecommendationItem {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public recommendationId!: number;

  @ManyToOne(() => Recommendation)
  @JoinColumn({ name: 'recommendationId', referencedColumnName: 'id' })
  public recommendationOfRecommendationItem!: Recommendation;

  @Column()
  public targetId!: string;

  @Column()
  public fairCode!: string;

  @Column()
  public fiscalYear!: string;

  @Column({ default: InterestedStatus.PENDING })
  public interestedStatus!: number;

  @Column()
  public meetingId!: string;

  @Column()
  public createdBy!: string;

  @CreateDateColumn({ type: 'datetime', default: new Date() })
  public creationTime!: Date;

  @Column()
  public lastUpdatedBy!: string;

  @UpdateDateColumn({ type: 'datetime', default: new Date() })
  public lastUpdatedAt!: Date;
}

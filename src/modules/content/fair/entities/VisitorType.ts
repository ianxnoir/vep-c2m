import { Column, Entity, Index, OneToMany } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('visitorTypeCode', ['visitorTypeCode'], { unique: true })
@Entity('visitorType', { schema: 'vepFairDb', database: 'vepFairDb' })
export class VisitorType extends VepItem {
  @Column('varchar', { primary: true, name: 'visitorTypeCode', length: 20 })
  visitorTypeCode!: string;

  @Column('varchar', { name: 'visitorTypeDesc', nullable: true, length: 255 })
  visitorTypeDesc!: string | null;

  @Column('varchar', {
    name: 'visitorTypeCategory',
    nullable: true,
    length: 20,
  })
  visitorTypeCategory!: string | null;

  @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.visitorTypeCode2)
  fairRegistrations!: FairRegistration[];
}

import { Column, Entity, Index, OneToMany } from 'typeorm';
import { FairRegistration } from './FairRegistration';
import { VepItem } from './VepItem';

@Index('sourceTypeCode', ['sourceTypeCode'], { unique: true })
@Entity('sourceType', { schema: 'vepFairDb', database: 'vepFairDb' })
export class SourceType extends VepItem {
  @Column('varchar', { primary: true, name: 'sourceTypeCode', length: 20 })
  sourceTypeCode!: string;

  @Column('varchar', { name: 'sourceTypeDesc', nullable: true, length: 255 })
  sourceTypeDesc!: string | null;

  @OneToMany(() => FairRegistration, (fairRegistration) => fairRegistration.sourceTypeCode2)
  fairRegistrations!: FairRegistration[];
}

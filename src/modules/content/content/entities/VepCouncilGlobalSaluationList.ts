import { Column, Entity, OneToOne, JoinColumn } from 'typeorm';
import { VepCouncilGlobalSalutation } from './VepCouncilGlobalSalutation';

@Entity('vep_council_global_saluation_list', { schema: 'vep_content', database: 'vep_content' })
export class VepCouncilGlobalSaluationList {
  @Column('bigint', { primary: true, name: 'id', unsigned: true })
  id!: string;

  @Column('text', { name: 'symbol', nullable: true })
  salutationSymbol!: string | null;

  @Column('text', { name: 'sid', nullable: true })
  sid!: string | null;

  @Column('text', { name: 'description', nullable: true })
  descEn!: string | null;

  @Column('datetime', { name: 'deletionTime', nullable: true })
  deletionTime!: Date | null;

  @OneToOne(() => VepCouncilGlobalSalutation)
  @JoinColumn([{ name: 'symbol', referencedColumnName: 'code' }])
  salutation!: VepCouncilGlobalSalutation;
}

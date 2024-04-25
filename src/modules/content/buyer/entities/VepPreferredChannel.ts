import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { VepBuyer } from './VepBuyer';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Entity('vepPreferredChannel', { schema: 'vepBuyerDb', database: 'vepBuyerDb' })
export class VepPreferredChannel extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('tinyint', { name: 'appPush', width: 1, default: () => "'0'" })
  appPush!: boolean;

  @Column('tinyint', { name: 'email', width: 1, default: () => "'0'" })
  email!: boolean;

  @Column('tinyint', { name: 'sms', width: 1, default: () => "'0'" })
  sms!: boolean;

  @Column('tinyint', { name: 'wechat', width: 1, default: () => "'0'" })
  wechat!: boolean;

  @Column('tinyint', { name: 'whatsapp', width: 1, default: () => "'0'" })
  whatsapp!: boolean;

  @OneToMany(() => VepBuyer, (vepBuyer) => vepBuyer.preferredChannel)
  vepBuyers!: VepBuyer[];
}

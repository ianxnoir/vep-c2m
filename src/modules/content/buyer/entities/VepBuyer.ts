import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { VepItem } from './VepItem';
import { VepPreferredChannel } from './VepPreferredChannel';

@Index('id', ['id'], { unique: true })
@Index('ssoUid', ['ssoUid'], { unique: true })
@Entity('vepBuyer', { schema: 'vepBuyerDb', database: 'vepBuyerDb' })
export class VepBuyer extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'ssoUid', unique: true, length: 50 })
  ssoUid!: string;

  @Column('varchar', { name: 'title', nullable: true, length: 10 })
  title!: string | null;

  @Column('varchar', { name: 'firstName', nullable: true, length: 30 })
  firstName!: string | null;

  @Column('varchar', { name: 'lastName', nullable: true, length: 30 })
  lastName!: string | null;

  @Column('varchar', { name: 'emailId', nullable: true, length: 150 })
  emailId!: string | null;

  @Column('varchar', { name: 'position', nullable: true, length: 255 })
  position!: string | null;

  @Column('varchar', { name: 'companyName', nullable: true, length: 255 })
  companyName!: string | null;

  @Column('varchar', { name: 'mobilePhoneNumber', nullable: true, length: 8 })
  mobilePhoneNumber!: string | null;

  @Column('varchar', {
    name: 'mobilePhoneCountryCode',
    nullable: true,
    length: 10,
  })
  mobilePhoneCountryCode!: string | null;

  @Column('varchar', {
    name: 'companyAddressLine1',
    nullable: true,
    length: 60,
  })
  companyAddressLine1!: string | null;

  @Column('varchar', {
    name: 'companyAddressLine2',
    nullable: true,
    length: 60,
  })
  companyAddressLine2!: string | null;

  @Column('varchar', {
    name: 'companyAddressLine3',
    nullable: true,
    length: 60,
  })
  companyAddressLine3!: string | null;

  @Column('varchar', {
    name: 'companyAddressLine4',
    nullable: true,
    length: 60,
  })
  companyAddressLine4!: string | null;

  @Column('varchar', {
    name: 'companyAddressPostalCode',
    nullable: true,
    length: 15,
  })
  companyAddressPostalCode!: string | null;

  @Column('varchar', {
    name: 'companyAddressCountryRegion',
    nullable: true,
    length: 3,
  })
  companyAddressCountryRegion!: string | null;

  @Column('varchar', {
    name: 'companyAddressStateProvince',
    nullable: true,
    length: 4,
  })
  companyAddressStateProvince!: string | null;

  @Column('varchar', { name: 'companyAddressCity', nullable: true, length: 4 })
  companyAddressCity!: string | null;

  @Column('varchar', { name: 'companyTel', nullable: true, length: 30 })
  companyTel!: string | null;

  @Column('varchar', {
    name: 'companyTelCountryCode',
    nullable: true,
    length: 10,
  })
  companyTelCountryCode!: string | null;

  @Column('varchar', { name: 'companyWebsite', nullable: true, length: 255 })
  companyWebsite!: string | null;

  @Column('varchar', { name: 'companyBackground', nullable: true, length: 500 })
  companyBackground!: string | null;

  @Column('bigint', {
    name: 'preferredChannelId',
    nullable: true,
    unsigned: true,
  })
  preferredChannelId!: string | null;

  @Column('varchar', { name: 'preferredLanguage', nullable: true, length: 10 })
  preferredLanguage!: string | null;

  @Column('varchar', { name: 'status', nullable: true, length: 10 })
  status!: string | null;

  @Column('tinyint', { name: 'showHide', width: 1, default: () => "'0'" })
  showHide!: boolean;

  @ManyToOne(() => VepPreferredChannel, (vepPreferredChannel) => vepPreferredChannel.vepBuyers, { onDelete: 'RESTRICT', onUpdate: 'CASCADE', cascade: true })
  @JoinColumn([{ name: 'preferredChannelId', referencedColumnName: 'id' }])
  preferredChannel!: VepPreferredChannel;
}

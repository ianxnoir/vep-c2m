import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { C2mParticipantStatus } from './C2mParticipantStatus';
import { VepExhibitorAttributes } from './VepExhibitorAttributes';
import { VepExhibitorC2mQuestions } from './VepExhibitorC2mQuestions';
import { VepExhibitorRegistrationStatus } from './VepExhibitorRegistrationStatus';
import { VepItem } from './VepItem';

@Index('id', ['id'], { unique: true })
@Index('c2mParticipantStatusId', ['c2mParticipantStatusId'], {})
@Index('vepExhibitorRegistrationStatusId', ['vepExhibitorRegistrationStatusId'], {})
@Entity('vepExhibitor', { schema: 'vepExhibitorDb', database: 'vepExhibitorDb' })
export class VepExhibitor extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('varchar', { name: 'companyCcdId', length: 255 })
  companyCcdId!: string;

  @Column('varchar', { name: 'individualCcdId', length: 255 })
  individualCcdId!: string;

  @Column('varchar', { name: 'eoaFairId', length: 255 })
  eoaFairId!: string;

  @Column('varchar', { name: 'ssoUid', nullable: true, length: 255 })
  ssoUid!: string | null;

  @Column('tinyint', { name: 'active', width: 1, default: () => "'0'" })
  active!: boolean;

  @Column('varchar', { name: 'eoaType', nullable: true, length: 20 })
  eoaType!: string | null;

  @Column('varchar', { name: 'vepType', nullable: true, length: 20 })
  vepType!: string | null;

  @Column('varchar', { name: 'companyName', nullable: true, length: 255 })
  companyName!: string | null;

  @Column('varchar', { name: 'addressLine1', nullable: true, length: 100 })
  addressLine1!: string | null;

  @Column('varchar', { name: 'addressLine2', nullable: true, length: 100 })
  addressLine2!: string | null;

  @Column('varchar', { name: 'addressLine3', nullable: true, length: 100 })
  addressLine3!: string | null;

  @Column('varchar', { name: 'addressLine4', nullable: true, length: 100 })
  addressLine4!: string | null;

  @Column('varchar', { name: 'country', nullable: true, length: 20 })
  country!: string | null;

  @Column('varchar', { name: 'stateOrProvince', nullable: true, length: 4 })
  stateOrProvince!: string | null;

  @Column('varchar', { name: 'city', nullable: true, length: 4 })
  city!: string | null;

  @Column('varchar', { name: 'postalCode', nullable: true, length: 15 })
  postalCode!: string | null;

  @Column('varchar', { name: 'salutation', nullable: true, length: 20 })
  salutation!: string | null;

  @Column('varchar', { name: 'contactName', nullable: true, length: 255 })
  contactName!: string | null;

  @Column('varchar', { name: 'contactEmail', nullable: true, length: 255 })
  contactEmail!: string | null;

  @Column('varchar', { name: 'position', nullable: true, length: 255 })
  position!: string | null;

  @Column('varchar', { name: 'companyPhoneCountryCode', nullable: true, length: 10 })
  companyPhoneCountryCode!: string | null;

  @Column('varchar', { name: 'companyPhoneAreaCode', nullable: true, length: 8 })
  companyPhoneAreaCode!: string | null;

  @Column('varchar', { name: 'companyPhoneNumberExt', nullable: true, length: 15 })
  companyPhoneNumberExt!: string | null;

  @Column('varchar', { name: 'companyPhoneNumber', nullable: true, length: 30 })
  companyPhoneNumber!: string | null;

  @Column('varchar', { name: 'mobilePhoneCountryCode', nullable: true, length: 10 })
  mobilePhoneCountryCode!: string | null;

  @Column('varchar', { name: 'mobilePhoneNumber', nullable: true, length: 30 })
  mobilePhoneNumber!: string | null;

  @Column('varchar', { name: 'agentName', nullable: true, length: 150 })
  agentName!: string | null;

  @Column('varchar', { name: 'boothNumber', nullable: true, length: 255 })
  boothNumber!: string | null;

  @Column('varchar', {
    name: 'companyBackground',
    nullable: true,
    length: 3000,
  })
  companyBackground!: string | null;

  @Column('tinyint', {
    name: 'virtualBoothIndicator',
    width: 1,
    default: () => "'0'",
  })
  virtualBoothIndicator!: boolean;

  @Column('varchar', { name: 'factoryLocation', nullable: true, length: 20 })
  factoryLocation!: string | null;

  @Column('varchar', {
    name: 'exhibitDescription',
    nullable: true,
    length: 500,
  })
  exhibitDescription!: string | null;

  @Column('varchar', { name: 'companyWebsite', nullable: true, length: 255 })
  companyWebsite!: string | null;

  @Column('tinyint', { name: 'c2mEnable', width: 1, default: () => "'0'" })
  c2mEnable!: boolean;

  @Column('bigint', {
    name: 'c2mParticipantStatusId',
    nullable: true,
    unsigned: true,
  })
  c2mParticipantStatusId!: string | null;

  @Column('bigint', {
    name: 'vepExhibitorRegistrationStatusId',
    nullable: true,
    unsigned: true,
  })
  vepExhibitorRegistrationStatusId!: string | null;

  // @Column('varchar', { name: 'c2mLogin', nullable: true, length: 2 })
  // c2mLogin!: string | null;

  // @Column('varchar', { name: 'c2mMeetingLogin', nullable: true, length: 2 })
  // c2mMeetingLogin!: string | null;

  @ManyToOne(() => C2mParticipantStatus, (c2mParticipantStatus) => c2mParticipantStatus.vepExhibitors, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'c2mParticipantStatusId', referencedColumnName: 'id' }])
  c2mParticipantStatus!: C2mParticipantStatus;

  @ManyToOne(() => VepExhibitorRegistrationStatus, (vepExhibitorRegistrationStatus) => vepExhibitorRegistrationStatus.vepExhibitors, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([{ name: 'vepExhibitorRegistrationStatusId', referencedColumnName: 'id' }])
  vepExhibitorRegistrationStatus!: VepExhibitorRegistrationStatus;

  @OneToMany(() => VepExhibitorAttributes, (vepExhibitorAttributes) => vepExhibitorAttributes.vepExhibitor)
  vepExhibitorAttributes!: VepExhibitorAttributes[];

  @OneToMany(() => VepExhibitorC2mQuestions, (vepExhibitorC2mQuestions) => vepExhibitorC2mQuestions.vepExhibitor)
  vepExhibitorC2mQuestions!: VepExhibitorC2mQuestions[];
}

import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FairRegistrationProductStrategy } from './FairRegistrationProductStrategy';
import { FairRegistrationPreferredSuppCountryRegion } from './FairRegistrationPreferredSuppCountryRegion';
import { FairRegistrationProductInterest } from './FairRegistrationProductInterest';
import { FairRegistrationNob } from './FairRegistrationNob';
import { FairRegistrationTypesOfTargetSuppliers } from './FairRegistrationTypesOfTargetSuppliers';
import { FairParticipant } from './FairParticipant';
import { FairRegistrationType } from './FairRegistrationType';
import { FairRegistrationStatus } from './FairRegistrationStatus';
import { FairParticipantType } from './FairParticipantType';
import { C2mParticipantStatus } from './C2mParticipantStatus';
import { FairFormTemplate } from './FairFormTemplate';
import { SourceType } from './SourceType';
import { VisitorType } from './VisitorType';
import { VepItem } from './VepItem';
// import { VepCouncilGlobalCountry } from '../../content/entities/VepCouncilGlobalCountry';
// import { VepFairSetting } from '../../content/entities/VepFairSetting';

@Index('id', ['id'], { unique: true })
@Index('serialNumber', ['serialNumber', 'projectYear', 'sourceTypeCode', 'visitorTypeCode', 'projectNumber'], { unique: true })
@Index('fairParticipantId', ['fairParticipantId'], {})
@Index('fairRegistrationTypeId', ['fairRegistrationTypeId'], {})
@Index('fairRegistrationStatusId', ['fairRegistrationStatusId'], {})
@Index('fairParticipantTypeId', ['fairParticipantTypeId'], {})
@Index('c2mParticipantStatusId', ['c2mParticipantStatusId'], {})
@Index('formTemplateId', ['formTemplateId'], {})
@Index('sourceTypeCode', ['sourceTypeCode'], {})
@Index('visitorTypeCode', ['visitorTypeCode'], {})
@Entity('fairRegistration', { schema: 'vepFairDb', database: 'vepFairDb' })
export class FairRegistration extends VepItem {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', unsigned: true })
  id!: string;

  @Column('bigint', {
    name: 'fairParticipantId',
    nullable: true,
    unsigned: true,
  })
  fairParticipantId!: string | null;

  @Column('varchar', { name: 'fairCode', nullable: true, length: 50 })
  fairCode!: string | null;

  @Column('varchar', { name: 'fiscalYear', nullable: true, length: 9 })
  fiscalYear!: string | null;

  @Column('varchar', { name: 'serialNumber', nullable: true, length: 20 })
  serialNumber!: string | null;

  @Column('varchar', { name: 'projectYear', nullable: true, length: 9 })
  projectYear!: string | null;

  @Column('varchar', { name: 'sourceTypeCode', nullable: true, length: 20 })
  sourceTypeCode!: string | null;

  @Column('varchar', { name: 'visitorTypeCode', nullable: true, length: 20 })
  visitorTypeCode!: string | null;

  @Column('varchar', { name: 'projectNumber', nullable: true, length: 20 })
  projectNumber!: string | null;

  @Column('varchar', {
    name: 'registrationNoChecksum',
    nullable: true,
    length: 255,
  })
  registrationNoChecksum!: string | null;

  @Column('bigint', {
    name: 'fairRegistrationTypeId',
    nullable: true,
    unsigned: true,
  })
  fairRegistrationTypeId!: string | null;

  @Column('bigint', {
    name: 'fairRegistrationStatusId',
    nullable: true,
    unsigned: true,
  })
  fairRegistrationStatusId!: string | null;

  @Column('bigint', {
    name: 'fairParticipantTypeId',
    nullable: true,
    unsigned: true,
  })
  fairParticipantTypeId!: string | null;

  @Column('bigint', {
    name: 'c2mParticipantStatusId',
    nullable: true,
    unsigned: true,
  })
  c2mParticipantStatusId!: string | null;

  @Column('varchar', { name: 'title', nullable: true, length: 20 })
  title!: string | null;

  @Column('varchar', { name: 'firstName', nullable: true, length: 255 })
  firstName!: string | null;

  @Column('varchar', { name: 'lastName', nullable: true, length: 255 })
  lastName!: string | null;

  @Column('varchar', { name: 'displayName', nullable: true, length: 255 })
  displayName!: string | null;

  @Column('varchar', { name: 'position', nullable: true, length: 255 })
  position!: string | null;

  @Column('varchar', { name: 'companyName', nullable: true, length: 255 })
  companyName!: string | null;

  @Column('varchar', { name: 'addressLine1', nullable: true, length: 255 })
  addressLine1!: string | null;

  @Column('varchar', { name: 'addressLine2', nullable: true, length: 255 })
  addressLine2!: string | null;

  @Column('varchar', { name: 'addressLine3', nullable: true, length: 255 })
  addressLine3!: string | null;

  @Column('varchar', { name: 'addressLine4', nullable: true, length: 255 })
  addressLine4!: string | null;

  @Column('varchar', { name: 'addressCountryCode', nullable: true })
  addressCountryCode!: string | null;

  @Column('varchar', { name: 'postalCode', nullable: true, length: 20 })
  postalCode!: string | null;

  @Column('varchar', {
    name: 'stateOrProvinceCode',
    nullable: true,
    length: 20,
  })
  stateOrProvinceCode!: string | null;

  @Column('varchar', { name: 'cityCode', nullable: true, length: 20 })
  cityCode!: string | null;

  @Column('varchar', {
    name: 'companyPhoneCountryCode',
    nullable: true,
    length: 20,
  })
  companyPhoneCountryCode!: string | null;

  @Column('varchar', {
    name: 'companyPhoneAreaCode',
    nullable: true,
    length: 20,
  })
  companyPhoneAreaCode!: string | null;

  @Column('varchar', {
    name: 'companyPhonePhoneNumber',
    nullable: true,
    length: 50,
  })
  companyPhonePhoneNumber!: string | null;

  @Column('varchar', {
    name: 'companyPhoneExtension',
    nullable: true,
    length: 20,
  })
  companyPhoneExtension!: string | null;

  @Column('varchar', { name: 'mobilePhoneNumber', nullable: true, length: 20 })
  mobilePhoneNumber!: string | null;

  @Column('varchar', {
    name: 'mobilePhoneCountryCode',
    nullable: true,
    length: 20,
  })
  mobilePhoneCountryCode!: string | null;

  @Column('varchar', { name: 'companyWebsite', nullable: true, length: 255 })
  companyWebsite!: string | null;

  @Column('varchar', {
    name: 'companyBackground',
    nullable: true,
    length: 3000,
  })
  companyBackground!: string | null;

  @Column('varchar', {
    name: 'overseasBranchOffice',
    nullable: true,
    length: 255,
  })
  overseasBranchOffice!: string | null;

  @Column('varchar', {
    name: 'overseasBranchOfficer',
    nullable: true,
    length: 255,
  })
  overseasBranchOfficer!: string | null;

  @Column('text', { name: 'cbmRemark', nullable: true })
  cbmRemark!: string | null;

  @Column('text', { name: 'vpRemark', nullable: true })
  vpRemark!: string | null;

  @Column('text', { name: 'generalBuyerRemark', nullable: true })
  generalBuyerRemark!: string | null;

  @Column('varchar', { name: 'companyCcdid', nullable: true, length: 20 })
  companyCcdid!: string | null;

  @Column('varchar', { name: 'tier', nullable: true, length: 20 })
  tier!: string | null;

  @Column('varchar', { name: 'individualCcdid', nullable: true, length: 20 })
  individualCcdid!: string | null;

  @Column('varchar', { name: 'euConsentStatus', nullable: true, length: 2 })
  euConsentStatus!: string | null;

  @Column('varchar', { name: 'badgeConsent', nullable: true, length: 2 })
  badgeConsent!: string | null;

  @Column('varchar', { name: 'c2mConsent', nullable: true, length: 2 })
  c2mConsent!: string | null;

  @Column('varchar', { name: 'c2mLogin', nullable: true, length: 2 })
  c2mLogin!: string | null;

  @Column('varchar', { name: 'c2mMeetingLogin', nullable: true, length: 2 })
  c2mMeetingLogin!: string | null;

  @Column('varchar', {
    name: 'registrationDetailConsent',
    nullable: true,
    length: 2,
  })
  registrationDetailConsent!: string | null;

  @Column('bigint', { name: 'formTemplateId', nullable: true, unsigned: true })
  formTemplateId!: string | null;

  @Column('mediumtext', { name: 'formDataJson', nullable: true })
  formDataJson!: string | null;

  @OneToMany(() => FairRegistrationProductStrategy, (fairRegistrationProductStrategy) => fairRegistrationProductStrategy.fairRegistration)
  fairRegistrationProductStrategies!: FairRegistrationProductStrategy[];

  @OneToMany(
    () => FairRegistrationPreferredSuppCountryRegion,
    (fairRegistrationPreferredSuppCountryRegion) => fairRegistrationPreferredSuppCountryRegion.fairRegistration
  )
  fairRegistrationPreferredSuppCountryRegions!: FairRegistrationPreferredSuppCountryRegion[];

  @OneToMany(() => FairRegistrationProductInterest, (fairRegistrationProductInterest) => fairRegistrationProductInterest.fairRegistration)
  fairRegistrationProductInterests!: FairRegistrationProductInterest[];

  @OneToMany(() => FairRegistrationNob, (fairRegistrationNob) => fairRegistrationNob.fairRegistration)
  fairRegistrationNobs!: FairRegistrationNob[];

  @OneToMany(() => FairRegistrationTypesOfTargetSuppliers, (fairRegistrationTypesOfTargetSuppliers) => fairRegistrationTypesOfTargetSuppliers.fairRegistration)
  fairRegistrationTypesOfTargetSuppliers!: FairRegistrationTypesOfTargetSuppliers[];

  @ManyToOne(() => FairParticipant, (fairParticipant) => fairParticipant.fairRegistrations, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'fairParticipantId', referencedColumnName: 'id' }])
  fairParticipant!: FairParticipant;

  @ManyToOne(() => FairRegistrationType, (fairRegistrationType) => fairRegistrationType.fairRegistrations, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'fairRegistrationTypeId', referencedColumnName: 'id' }])
  fairRegistrationType!: FairRegistrationType;

  @ManyToOne(() => FairRegistrationStatus, (fairRegistrationStatus) => fairRegistrationStatus.fairRegistrations, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'fairRegistrationStatusId', referencedColumnName: 'id' }])
  fairRegistrationStatus!: FairRegistrationStatus;

  @ManyToOne(() => FairParticipantType, (fairParticipantType) => fairParticipantType.fairRegistrations, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'fairParticipantTypeId', referencedColumnName: 'id' }])
  fairParticipantType!: FairParticipantType;

  @ManyToOne(() => C2mParticipantStatus, (c2mParticipantStatus) => c2mParticipantStatus.fairRegistrations, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'c2mParticipantStatusId', referencedColumnName: 'id' }])
  c2mParticipantStatus!: C2mParticipantStatus;

  @ManyToOne(() => FairFormTemplate, (fairFormTemplate) => fairFormTemplate.fairRegistrations, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'formTemplateId', referencedColumnName: 'id' }])
  formTemplate!: FairFormTemplate;

  @ManyToOne(() => SourceType, (sourceType) => sourceType.fairRegistrations, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([{ name: 'sourceTypeCode', referencedColumnName: 'sourceTypeCode' }])
  sourceTypeCode2!: SourceType;

  @ManyToOne(() => VisitorType, (visitorType) => visitorType.fairRegistrations, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn([{ name: 'visitorTypeCode', referencedColumnName: 'visitorTypeCode' }])
  visitorTypeCode2!: VisitorType;

  // @ManyToOne(() => VepCouncilGlobalCountry, (addressCountry) => addressCountry.fairRegistrations, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  // @JoinColumn([{ name: 'addressCountryCode', referencedColumnName: 'code' }])
  // addressCountry!: VepCouncilGlobalCountry;

  // @ManyToOne(() => VepFairSetting, (vepFairSetting) => vepFairSetting.fairRegistrations, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  // @JoinColumn([{ name: 'fairCode', referencedColumnName: 'faircode' }])
  // fairSetting!: VepFairSetting;
}

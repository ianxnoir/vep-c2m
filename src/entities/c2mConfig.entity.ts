import { IsNotEmpty } from 'class-validator';
import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { C2mConfigUnit } from '../modules/cbm/cbm.type';

@Entity({
  name: 'vepC2MConfig',
  schema: 'vep_c2m_service_db',
})
export class C2mConfigEntity {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  @IsNotEmpty()
  public fieldName!: string;

  @Column()
  @IsNotEmpty()
  public unit!: C2mConfigUnit;

  @Column()
  @IsNotEmpty()
  public configValue!: string;

  @Column()
  @IsNotEmpty()
  public lastUpdatedBy!: string;

  @UpdateDateColumn()
  @IsNotEmpty()
  public lastUpdatedAt!: Date;
}

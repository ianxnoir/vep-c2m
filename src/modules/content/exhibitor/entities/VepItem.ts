import { Column } from 'typeorm';

export class VepItem {
  @Column('varchar', { name: 'createdBy', length: 20 })
  createdBy!: string;

  @Column('timestamp', {
    name: 'creationTime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  creationTime!: Date;

  @Column('varchar', { name: 'lastUpdatedBy', length: 20 })
  lastUpdatedBy!: string;

  @Column('timestamp', {
    name: 'lastUpdatedTime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastUpdatedTime!: Date;

  @Column('timestamp', {
    name: 'deletionTime',
    default: () => "'0000-00-00 00:00:00'",
  })
  deletionTime!: Date;
}

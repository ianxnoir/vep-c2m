import { HttpModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { UtilsModule } from '../../../core/utils/utils';

import { VepCouncilGlobalCountryList } from '../../content/content/entities/VepCouncilGlobalCountryList';
import { VepCouncilGlobalLocation1 } from '../../content/content/entities/VepCouncilGlobalLocation1';
import { VepCouncilGlobalNobProvinceList } from '../../content/content/entities/VepCouncilGlobalNobProvinceList';
import { VepFairSetting } from '../../content/content/entities/VepFairSetting';
import { C2mParticipantStatus as FC2mParticipantStatus } from '../../content/fair/entities/C2mParticipantStatus';
import { FairFormTemplate } from '../../content/fair/entities/FairFormTemplate';
import { FairParticipant } from '../../content/fair/entities/FairParticipant';
import { FairParticipantType } from '../../content/fair/entities/FairParticipantType';
import { FairRegistration } from '../../content/fair/entities/FairRegistration';
import { FairRegistrationNob } from '../../content/fair/entities/FairRegistrationNob';
import { FairRegistrationPreferredSuppCountryRegion } from '../../content/fair/entities/FairRegistrationPreferredSuppCountryRegion';
import { FairRegistrationProductInterest } from '../../content/fair/entities/FairRegistrationProductInterest';
import { FairRegistrationProductStrategy } from '../../content/fair/entities/FairRegistrationProductStrategy';
import { FairRegistrationStatus } from '../../content/fair/entities/FairRegistrationStatus';
import { FairRegistrationType } from '../../content/fair/entities/FairRegistrationType';
import { FairRegistrationTypesOfTargetSuppliers } from '../../content/fair/entities/FairRegistrationTypesOfTargetSuppliers';
import { SourceType } from '../../content/fair/entities/SourceType';
import { VisitorType } from '../../content/fair/entities/VisitorType';
import { getDBConfig } from '../../utils';
import { FairService } from './fair.service';

@Module({
  imports: [
    HttpModule,
    UtilsModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      name: 'fairDatabase',
      useFactory: (configService: ConfigService) => {
        const contentDb = configService.get<MysqlConnectionOptions>('content')!;
        const database = configService.get<string>('content.fairDatabase')!;
        return getDBConfig(contentDb, database, [FairRegistration,
          FairParticipantType,
          FairParticipant,
          FairRegistrationStatus,
          FairRegistrationProductStrategy,
          FairRegistrationPreferredSuppCountryRegion,
          FairRegistrationProductInterest,
          FairRegistrationNob,
          FairRegistrationTypesOfTargetSuppliers,
          FairRegistrationType,
          FC2mParticipantStatus,
          FairFormTemplate,
          SourceType,
          VisitorType,
          VepCouncilGlobalCountryList,
          VepCouncilGlobalNobProvinceList,
          VepCouncilGlobalLocation1,
          VepFairSetting]);
      },
    }),
    TypeOrmModule.forFeature(
      [
        FairRegistration,
        FairParticipantType,
        FairParticipant,
        FairRegistrationStatus,
        FairRegistrationProductStrategy,
        FairRegistrationPreferredSuppCountryRegion,
        FairRegistrationProductInterest,
        FairRegistrationNob,
        FairRegistrationTypesOfTargetSuppliers,
        FairRegistrationType,
        FC2mParticipantStatus,
        FairFormTemplate,
        SourceType,
        VisitorType,
        VepCouncilGlobalCountryList,
        VepCouncilGlobalNobProvinceList,
        VepCouncilGlobalLocation1,
        VepFairSetting,
      ],
      'fairDatabase'
    ),
  ],
  exports: [FairService],
  providers: [FairService],
})
export class FairModule {}

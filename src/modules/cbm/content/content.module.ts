import { HttpModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { UtilsModule } from '../../../core/utils/utils';
import { VepCouncilGlobalCountry as Country } from '../../content/content/entities/VepCouncilGlobalCountry';
import { VepCouncilGlobalNob as Nob } from '../../content/content/entities/VepCouncilGlobalNob';
import { VepCouncilGlobalOffice as Office } from '../../content/content/entities/VepCouncilGlobalOffice';
import { VepCouncilGlobalTargetMarket as TargetMarket } from '../../content/content/entities/VepCouncilGlobalTargetMarket';
import { VepFairSetting as FairSetting } from '../../content/content/entities/VepFairSetting';
import { getDBConfig } from '../../utils';
import { ContentService } from './content.service';

@Module({
  imports: [
    HttpModule,
    UtilsModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      name: 'contentDatabase',
      useFactory: (configService: ConfigService) => {
        const contentDb = configService.get<MysqlConnectionOptions>('content')!;
        const database = configService.get<string>('content.contentDatabase')!;
        return getDBConfig(contentDb, database, [FairSetting, Country, Office, Nob, TargetMarket]);
      },
    }),
    TypeOrmModule.forFeature([FairSetting, Country, Office, Nob, TargetMarket], 'contentDatabase'),
  ],
  exports: [ContentService],
  providers: [ContentService],
})
export class ContentModule {}

import { HttpModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { ElasticacheClusterModule } from '../../../core/elasticachecluster/elasticachecluster.providers';
import { UtilsModule } from '../../../core/utils/utils';
import { Meeting } from '../../../entities/meeting.entity';
import { RecommendationItem } from '../../../entities/recommendationItem.entity';
import { ApiExhibitorService } from '../../api/exhibitor/exhibitor.service';
import { ApiFairService } from '../../api/fair/fair.service';
import { LambdaModule } from '../../api/lambda/lambda.module';
import { MeetingModule } from '../../c2m/meeting/meeting.module';
import { MeetingService } from '../../c2m/meeting/meeting.service';
// import { RecommendationModule } from '../../c2m/recommendation/recommendation.module';

import { C2mParticipantStatus } from '../../content/exhibitor/entities/C2mParticipantStatus';
import { VepExhibitor as Exhibitor } from '../../content/exhibitor/entities/VepExhibitor';
import { VepExhibitorAttributes as ExhibitorAttributes } from '../../content/exhibitor/entities/VepExhibitorAttributes';
import { VepExhibitorC2mAnswers as ExhibitorC2mAnswers } from '../../content/exhibitor/entities/VepExhibitorC2mAnswers';
import { VepExhibitorC2mQuestions as ExhibitorC2mQuestions } from '../../content/exhibitor/entities/VepExhibitorC2mQuestions';
import { VepExhibitorRegistrationStatus as ExhibitorRegistrationStatus } from '../../content/exhibitor/entities/VepExhibitorRegistrationStatus';
import { getDBConfig } from '../../utils';
import { ContentModule } from '../content/content.module';
import { ExhibitorService } from './exhibitor.service';

@Module({
  imports: [
    HttpModule,
    UtilsModule,
    MeetingModule,
    ContentModule,
    TypeOrmModule.forFeature([Meeting]),
    TypeOrmModule.forFeature([RecommendationItem]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      name: 'exhibitorDatabase',
      useFactory: (configService: ConfigService) => {
        const contentDb = configService.get<MysqlConnectionOptions>('content')!;
        const database = configService.get<string>('content.exhibitorDatabase')!;
        return getDBConfig(contentDb, database, [Exhibitor, ExhibitorAttributes, C2mParticipantStatus, ExhibitorRegistrationStatus, ExhibitorC2mAnswers, ExhibitorC2mQuestions]);
      },
    }),
    TypeOrmModule.forFeature(
      [Exhibitor, ExhibitorAttributes, C2mParticipantStatus, ExhibitorRegistrationStatus, ExhibitorC2mAnswers, ExhibitorC2mQuestions],
      'exhibitorDatabase'
    ),
    LambdaModule,
    ElasticacheClusterModule
  ],
  exports: [ExhibitorService, ApiFairService, ApiExhibitorService],
  providers: [MeetingService, ExhibitorService, ApiFairService, ApiExhibitorService],
})
export class ExhibitorModule {}

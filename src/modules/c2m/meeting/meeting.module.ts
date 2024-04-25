import { HttpModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Meeting } from '../../../entities/meeting.entity';
import { NotificationEntity } from '../../../entities/notification.entity';
import { UserMeta } from '../../../entities/userMeta';
import { BuyerService } from '../../api/buyer/buyer.service';
import { ApiExhibitorService } from '../../api/exhibitor/exhibitor.service';
import { FairModule } from '../../api/fair/fair.module';
import { NotificationAPIService } from '../../api/notificationAPI/notificationAPI.service';
import { C2MService } from '../c2m.service';
import { NotificationService } from '../notification/notification.service';
import { MeetingService } from './meeting.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VepExhibitor } from '../../content/exhibitor/entities/VepExhibitor';
import { VepExhibitorAttributes } from '../../content/exhibitor/entities/VepExhibitorAttributes';
import { VepExhibitorRegistrationStatus } from '../../content/exhibitor/entities/VepExhibitorRegistrationStatus';
import { VepExhibitorC2mAnswers } from '../../content/exhibitor/entities/VepExhibitorC2mAnswers';
import { VepExhibitorC2mQuestions } from '../../content/exhibitor/entities/VepExhibitorC2mQuestions';
import { ExhibitorNotificationEntity } from '../../content/exhibitor/entities/notification.entity';
import { C2mParticipantStatus } from '../../content/exhibitor/entities/C2mParticipantStatus';
import { VepBuyer } from '../../content/buyer/entities/VepBuyer';
import { VepPreferredChannel } from '../../content/buyer/entities/VepPreferredChannel';
import { BuyerNotificationEntity } from '../../content/buyer/entities/notification.entity';
import { C2mConfigEntity } from '../../../entities/c2mConfig.entity';
import { Recommendation } from '../../../entities/recommendation.entity';
import { Registration } from '../../content/buyer/entities/seminarRegistration';
import { RecommendationItem } from '../../../entities/recommendationItem.entity';
import { MeetingConfig } from '../../../entities/meetingConfig.entity';
import { SnsService } from '../../api/sns/sns.service';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { getDBConfig } from '../../utils';

@Module({
  imports: [
    FairModule,
    TypeOrmModule.forFeature([Meeting, UserMeta, NotificationEntity, C2mConfigEntity, Recommendation, RecommendationItem, MeetingConfig]), HttpModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      name: 'exhibitorDatabase',
      useFactory: (configService: ConfigService) => {
        const contentDb = configService.get<MysqlConnectionOptions>('content')!;
        const database = configService.get<string>('content.exhibitorDatabase')!;
        return getDBConfig(contentDb, database, [VepExhibitor, VepExhibitorAttributes, C2mParticipantStatus,
          VepExhibitorRegistrationStatus, VepExhibitorC2mAnswers, VepExhibitorC2mQuestions, ExhibitorNotificationEntity]);
      },
    }),
    TypeOrmModule.forFeature(
      [VepExhibitor, VepExhibitorAttributes, C2mParticipantStatus, VepExhibitorRegistrationStatus, VepExhibitorC2mAnswers, VepExhibitorC2mQuestions, ExhibitorNotificationEntity]
    ),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      name: 'exhibitorDatabaseForWrite',
      useFactory: (configService: ConfigService) => ({
        type: 'mariadb',
        host: configService.get<string>('exhibitor.host'),
        username: configService.get<string>('exhibitor.username'),
        password: configService.get<string>('exhibitor.password'),
        port: configService.get<number>('exhibitor.port'),
        database: configService.get<string>('exhibitor.database'),
        entities: [VepExhibitor, VepExhibitorAttributes, C2mParticipantStatus, VepExhibitorRegistrationStatus, VepExhibitorC2mAnswers, VepExhibitorC2mQuestions, ExhibitorNotificationEntity],
      }),
    }),
    TypeOrmModule.forFeature(
      [VepExhibitor, VepExhibitorAttributes, C2mParticipantStatus, VepExhibitorRegistrationStatus, VepExhibitorC2mAnswers, VepExhibitorC2mQuestions, ExhibitorNotificationEntity],
      'exhibitorDatabaseForWrite'
    ),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      name: 'buyerDatabaseForWrite',
      useFactory: (configService: ConfigService) => ({
        type: 'mariadb',
        host: configService.get<string>('fair.host'),
        username: configService.get<string>('fair.username'),
        password: configService.get<string>('fair.password'),
        port: configService.get<number>('fair.port'),
        database: configService.get<string>('fair.database'),
        entities: [VepBuyer, VepPreferredChannel, BuyerNotificationEntity, Registration],
      }),
    }),
    TypeOrmModule.forFeature(
      [VepBuyer, VepPreferredChannel, BuyerNotificationEntity, Registration],
      'buyerDatabaseForWrite'
    )
  ],

  providers: [MeetingService, ApiExhibitorService, BuyerService, C2MService, NotificationService, NotificationAPIService, SnsService],
  exports: [MeetingService, C2MService],
})
export class MeetingModule {}

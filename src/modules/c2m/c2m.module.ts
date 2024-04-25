import { Module, HttpModule, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqsService } from '@vep/sqs-package-registry';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { UtilsModule } from '../../core/utils/utils';
import { C2mConfigEntity } from '../../entities/c2mConfig.entity';
import { MeetingConfig } from '../../entities/meetingConfig.entity';
import { NotificationEntity } from '../../entities/notification.entity';
import { Recommendation } from '../../entities/recommendation.entity';
import { RecommendationItem } from '../../entities/recommendationItem.entity';
import { UserMeta } from '../../entities/userMeta';
import { ValidateMeetingRoleMiddleware } from '../../middleware/validateMeetingRole.middleware';
import { BuyerModuleForEmailProfile } from '../api/buyer/buyer.module';
import { BuyerService } from '../api/buyer/buyer.service';
import { ContentApiModule } from '../api/content/content.module';
import { ExhibitorModule } from '../api/exhibitor/exhibitor.module';
import { FairModule } from '../api/fair/fair.module';
import { NotificationAPIService } from '../api/notificationAPI/notificationAPI.service';
import { SnsService } from '../api/sns/sns.service';
import { BuyerModule } from '../cbm/buyer/buyer.module';
import { CBMService } from '../cbm/cbm.service';
import { BuyerNotificationEntity } from '../content/buyer/entities/notification.entity';
import { Registration } from '../content/buyer/entities/seminarRegistration';
import { VepBuyer } from '../content/buyer/entities/VepBuyer';
import { VepPreferredChannel } from '../content/buyer/entities/VepPreferredChannel';
import { C2mParticipantStatus } from '../content/exhibitor/entities/C2mParticipantStatus';
import { ExhibitorNotificationEntity } from '../content/exhibitor/entities/notification.entity';
import { VepExhibitor } from '../content/exhibitor/entities/VepExhibitor';
import { VepExhibitorAttributes } from '../content/exhibitor/entities/VepExhibitorAttributes';
import { VepExhibitorC2mAnswers } from '../content/exhibitor/entities/VepExhibitorC2mAnswers';
import { VepExhibitorC2mQuestions } from '../content/exhibitor/entities/VepExhibitorC2mQuestions';
import { VepExhibitorRegistrationStatus } from '../content/exhibitor/entities/VepExhibitorRegistrationStatus';
import { getDBConfig } from '../utils';
import { C2MController } from './c2m.controller';
import { C2MService } from './c2m.service';
import { MeetingModule } from './meeting/meeting.module';
import { NotificationModule } from './notification/notification.module';
import { NotificationService } from './notification/notification.service';
import { RecommendationModule } from './recommendation/recommendation.module';
import { RecommendationService } from './recommendation/recommendation.service';
import { C2MSchedulerModule } from './schedulers/scheduler.module';
import { TealiumModule } from './tealium/tealium.module';
import { UnavailableTimeslotModule } from './unavailableTimeslot/unavailableTimeslot.module';

@Module({
  imports: [
    HttpModule,
    MeetingModule,
    UnavailableTimeslotModule,
    C2MSchedulerModule,
    ExhibitorModule,
    FairModule,
    UtilsModule,
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
    TypeOrmModule.forFeature([UserMeta, NotificationEntity, C2mConfigEntity, Recommendation, RecommendationItem, MeetingConfig]),
    BuyerModule,
    BuyerModuleForEmailProfile,
    NotificationModule,
    ContentApiModule,
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
    ),
    TealiumModule,
    RecommendationModule,
  ],
  controllers: [C2MController],
  providers: [C2MService, SqsService, BuyerService, NotificationService, NotificationAPIService, ContentApiModule, CBMService, RecommendationService, SnsService],
})
export class C2MModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ValidateMeetingRoleMiddleware)
      .forRoutes('c2m/fairs/:fairCode/meetings/:id');
  }
}

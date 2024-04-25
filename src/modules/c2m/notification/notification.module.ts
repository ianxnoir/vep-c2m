import { HttpModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqsService } from '@vep/sqs-package-registry';
import { C2mConfigEntity } from '../../../entities/c2mConfig.entity';
import { MeetingConfig } from '../../../entities/meetingConfig.entity';
import { ElasticacheClusterModule } from '../../../core/elasticachecluster/elasticachecluster.providers';
import { NotificationEntity } from '../../../entities/notification.entity';
import { Recommendation } from '../../../entities/recommendation.entity';
import { RecommendationItem } from '../../../entities/recommendationItem.entity';
import { UserMeta } from '../../../entities/userMeta';
import { BuyerModuleForEmailProfile } from '../../api/buyer/buyer.module';
import { BuyerService } from '../../api/buyer/buyer.service';
import { ApiExhibitorService } from '../../api/exhibitor/exhibitor.service';
import { ApiFairService } from '../../api/fair/fair.service';
import { NotificationAPIService } from '../../api/notificationAPI/notificationAPI.service';
import { SnsService } from '../../api/sns/sns.service';
import { BuyerNotificationEntity } from '../../content/buyer/entities/notification.entity';
import { Registration } from '../../content/buyer/entities/seminarRegistration';
import { VepBuyer } from '../../content/buyer/entities/VepBuyer';
import { VepPreferredChannel } from '../../content/buyer/entities/VepPreferredChannel';
import { C2mParticipantStatus } from '../../content/exhibitor/entities/C2mParticipantStatus';
import { ExhibitorNotificationEntity } from '../../content/exhibitor/entities/notification.entity';
import { VepExhibitor } from '../../content/exhibitor/entities/VepExhibitor';
import { VepExhibitorAttributes } from '../../content/exhibitor/entities/VepExhibitorAttributes';
import { VepExhibitorC2mAnswers } from '../../content/exhibitor/entities/VepExhibitorC2mAnswers';
import { VepExhibitorC2mQuestions } from '../../content/exhibitor/entities/VepExhibitorC2mQuestions';
import { VepExhibitorRegistrationStatus } from '../../content/exhibitor/entities/VepExhibitorRegistrationStatus';
import { C2MService } from '../c2m.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { getDBConfig } from '../../utils';

@Module({
  imports: [
    HttpModule,
    BuyerModuleForEmailProfile,
    TypeOrmModule.forFeature([NotificationEntity, Recommendation, RecommendationItem, UserMeta, C2mConfigEntity, MeetingConfig]),
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
    ),
    ElasticacheClusterModule
  ],
  controllers: [NotificationController],
  providers: [NotificationService, SqsService, ConfigService, ApiExhibitorService, ApiFairService, BuyerService, NotificationAPIService, RecommendationService, C2MService, SnsService],
})
export class NotificationModule {}

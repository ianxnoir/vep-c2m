import { HttpModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticacheClusterModule } from '../../../core/elasticachecluster/elasticachecluster.providers';
import { C2mConfigEntity } from '../../../entities/c2mConfig.entity';
import { Meeting } from '../../../entities/meeting.entity';
import { MeetingConfig } from '../../../entities/meetingConfig.entity';
import { NotificationEntity } from '../../../entities/notification.entity';

import { Recommendation } from '../../../entities/recommendation.entity';
import { RecommendationItem } from '../../../entities/recommendationItem.entity';
import { UserMeta } from '../../../entities/userMeta';
import { BuyerService } from '../../api/buyer/buyer.service';
import { ApiExhibitorService } from '../../api/exhibitor/exhibitor.service';
import { FairModule } from '../../api/fair/fair.module';
import { ApiFairService } from '../../api/fair/fair.service';
import { NotificationAPIService } from '../../api/notificationAPI/notificationAPI.service';
import { SnsService } from '../../api/sns/sns.service';
import { ExhibitorModule } from '../../cbm/exhibitor/exhibitor.module';
import { BuyerNotificationEntity } from '../../content/buyer/entities/notification.entity';
import { Registration } from '../../content/buyer/entities/seminarRegistration';
import { VepBuyer } from '../../content/buyer/entities/VepBuyer';
import { VepPreferredChannel } from '../../content/buyer/entities/VepPreferredChannel';
import { ExhibitorNotificationEntity } from '../../content/exhibitor/entities/notification.entity';

import { C2MService } from '../c2m.service';
import { NotificationService } from '../notification/notification.service';

import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';

@Module({
  imports: [
    HttpModule,
    FairModule,
    ExhibitorModule,
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
        entities: [ExhibitorNotificationEntity],
      }),
    }),
    TypeOrmModule.forFeature(
      [ExhibitorNotificationEntity],
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
    TypeOrmModule.forFeature([Recommendation, RecommendationItem, UserMeta, NotificationEntity, Meeting, C2mConfigEntity, RecommendationItem, MeetingConfig]),
    ElasticacheClusterModule
  ],
  providers: [RecommendationService, RecommendationItem, C2MService, NotificationService, NotificationAPIService, BuyerService, ApiFairService, ApiExhibitorService, SnsService],
  controllers: [RecommendationController],
  exports: [RecommendationService],
})
export class RecommendationModule {}

import { HttpModule, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import moment from 'moment-timezone';

import { configuration } from './config';
import { DatabaseModule } from './core/database/database.providers';
import { GlobalExceptionsFilter } from './core/filters';
import { LoggerMiddleware } from './core/utils';
import { UtilsModule } from './core/utils/utils';
import { AdminPermission } from './middleware/adminPermission.middleware';
import { AuthMiddleware } from './middleware/auth.middleware';
import { GetExhibitorIDMiddleware } from './middleware/getExhibitorID.middleware';
import { ExhibitorModule as ApiExhibitorModule } from './modules/api/exhibitor/exhibitor.module';
import { C2MModule } from './modules/c2m/c2m.module';
import { HiddenRecordModule } from './modules/c2m/hiddenRecord/hiddenRecord.module';
import { RecommendationModule } from './modules/c2m/recommendation/recommendation.module';
import { VideoConferenceModule } from './modules/c2m/videoConference/videoConference.module';
import { CBMModule } from './modules/cbm/cbm.module';
import { ChatroomModule } from './modules/chatroom/chatroom.module';
import { ReuseLicenseModule } from './modules/c2m/reuseLicense/reuseLicense.module';
import { HealthModule } from './health/health.module';
import {AppService} from "./app.service";
import { ElasticacheClusterModule } from './core/elasticachecluster/elasticachecluster.providers';
import { FairModule } from './modules/api/fair/fair.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Database
    DatabaseModule,

    // Logger
    UtilsModule,

    // HttpModule
    HttpModule,

    // JWT
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: process.env.JWT_SECRET || 'somehardcodevalue',
      }),
      inject: [ConfigService],
    }),

    // API
    C2MModule,
    CBMModule,
    ApiExhibitorModule,
    VideoConferenceModule,
    HiddenRecordModule,
    RecommendationModule,
    ChatroomModule,
    ReuseLicenseModule,
    HealthModule,
    ElasticacheClusterModule,
    FairModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionsFilter,
    },AppService
  ],
})
export class AppModule implements NestModule {
  private excludeAuthRoutes: string[] = [
    'c2m',
    'c2m/video-conference/(.*)',
    'c2m/fairs/(.*)/meetings/(.*)/video-conference/guest',
    'c2m/fairs/(.*)/meetings/(.*)/guest',
  ];

  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware, AdminPermission).forRoutes('*');

    consumer
      .apply(AuthMiddleware)
      .exclude(...this.excludeAuthRoutes)
      .forRoutes('c2m');

    consumer.apply(GetExhibitorIDMiddleware).forRoutes('c2m');
    moment.tz.setDefault('UTC');
  }
}

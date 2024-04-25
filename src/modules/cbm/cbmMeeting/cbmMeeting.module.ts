import { HttpModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { UtilsModule } from '../../../core/utils/utils';
import { Meeting } from '../../content/c2m/entities/meeting.entity';
import { getDBConfig } from '../../utils';
import { BuyerModule } from '../buyer/buyer.module';
import { ExhibitorModule } from '../exhibitor/exhibitor.module';
import { CBMMeetingService } from './cbmMeeting.service';

@Module({
  imports: [
    HttpModule,
    UtilsModule,
    BuyerModule,
    ExhibitorModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      name: 'c2mDatabase',
      useFactory: (configService: ConfigService) => {
        const contentDb = configService.get<MysqlConnectionOptions>('content')!;
        const database = configService.get<string>('content.c2mDatabase')!;
        return getDBConfig(contentDb, database, [Meeting]);
      },
    }),
    TypeOrmModule.forFeature([Meeting]),
  ],
  exports: [CBMMeetingService],
  providers: [CBMMeetingService],
})
export class CBMMeetingModule {}

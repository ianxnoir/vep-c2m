import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsV4HttpModule } from 'nestjs-aws-v4';
import { Meeting } from '../../../entities/meeting.entity';
import { VideoConference } from '../../../entities/videoConference.entity';
import { ExhibitorModule } from '../../api/exhibitor/exhibitor.module';
import { LambdaModule } from '../../api/lambda/lambda.module';
import { ZoomModule } from '../../api/zoom/zoom.module';
import { MeetingModule } from '../../c2m/meeting/meeting.module';
import { VideoConferenceService } from '../../c2m/videoConference/videoConference.service';
import { CBMVideoConferenceController } from './cbmVideoConference.controller';

@Module({
  imports: [
    // to-do - jack - remove later
    JwtModule.register({ secret: process.env.JWT_SECRET || '51%$efDFwer'  }),
    TypeOrmModule.forFeature([VideoConference]),
    TypeOrmModule.forFeature([Meeting]),
    MeetingModule,
    ZoomModule,
    ExhibitorModule,
    ConfigModule,
    // AWS SigV4
    AwsV4HttpModule.register({
      region: 'ap-east-1',
      service: 'execute-api',
      credentials: { 
        accessKeyId: process.env.WS_API_GW_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.WS_API_GW_SECRET_ACCESS_KEY || '',
      },
    }),
    LambdaModule
  ],
  controllers: [CBMVideoConferenceController],
  providers: [VideoConferenceService],
  exports: [VideoConferenceService],
})
export class CBMVideoConferenceModule {}

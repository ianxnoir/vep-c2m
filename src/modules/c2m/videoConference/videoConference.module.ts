import { HttpModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsV4HttpModule } from 'nestjs-aws-v4';
import { ElasticacheClusterModule } from '../../../core/elasticachecluster/elasticachecluster.providers';
import { Meeting } from '../../../entities/meeting.entity';
import { SendbirdLicense } from '../../../entities/sendbirdLicense.entity';
import { VideoConference } from '../../../entities/videoConference.entity';
import { ZOOMLicense } from '../../../entities/zoomLicense.entity';
import { EMPModule } from '../../api/emp/emp.module';
import { ExhibitorModule } from '../../api/exhibitor/exhibitor.module';
import { ApiFairService } from '../../api/fair/fair.service';
import { LambdaModule } from '../../api/lambda/lambda.module';
import { ZoomModule } from '../../api/zoom/zoom.module';
import { MeetingModule } from '../meeting/meeting.module';
import { ReuseLicenseModule } from '../reuseLicense/reuseLicense.module';
import { ReuseLicenseService } from '../reuseLicense/reuseLicense.service';
import { VideoConferenceController } from './videoConference.controller';
import { VideoConferenceService } from './videoConference.service';

@Module({
  imports: [
    // to-do - jack - remove later
    HttpModule,
    JwtModule.register({ secret: process.env.JWT_SECRET || '51%$efDFwer' }),
    TypeOrmModule.forFeature([VideoConference, Meeting, SendbirdLicense, ZOOMLicense]),
    MeetingModule,
    ZoomModule,
    ExhibitorModule,
    ConfigModule,
    EMPModule,
    // AWS SigV4
    AwsV4HttpModule.register({
      region: 'ap-east-1',
      service: 'execute-api',
      credentials: { 
        accessKeyId: process.env.WS_API_GW_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.WS_API_GW_SECRET_ACCESS_KEY || '',
      },
    }),
    ReuseLicenseModule,
    LambdaModule,
    ElasticacheClusterModule
  ],
  controllers: [VideoConferenceController],
  providers: [VideoConferenceService, ReuseLicenseService, ApiFairService],
  exports: [VideoConferenceService],
})
export class VideoConferenceModule {}

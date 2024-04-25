import { Module, HttpModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilsModule } from '../../core/utils/utils';
import { C2mConfigEntity } from '../../entities/c2mConfig.entity';
import { Meeting } from '../../entities/meeting.entity';
import { UserMeta } from '../../entities/userMeta';
import { FairModule as ApiFairModule } from '../api/fair/fair.module';
import { MeetingModule } from '../c2m/meeting/meeting.module';
import { UnavailableTimeslotModule } from '../c2m/unavailableTimeslot/unavailableTimeslot.module';
import { BuyerModule } from './buyer/buyer.module';
import { CBMController } from './cbm.controller';
import { CBMService } from './cbm.service';
import { CBMMeetingModule } from './cbmMeeting/cbmMeeting.module';
import { CBMVideoConferenceModule } from './cbmVideoConference/cbmVideoConference.modules';
import { ContentModule } from './content/content.module';
import { ExhibitorModule } from './exhibitor/exhibitor.module';
import { FairModule } from './fair/fair.module';

@Module({
  imports: [
    HttpModule,
    UtilsModule,
    UnavailableTimeslotModule,
    MeetingModule,
    CBMMeetingModule,
    CBMVideoConferenceModule,
    ApiFairModule,
    ExhibitorModule,
    FairModule,
    BuyerModule,
    ContentModule,
    TypeOrmModule.forFeature([UserMeta, Meeting, C2mConfigEntity]),
  ],
  controllers: [CBMController],
  providers: [CBMService],
})

export class CBMModule {}

// implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer
//       .apply(ValidateMeetingRoleMiddleware)
//       .forRoutes('cbm/fairs/:fairCode/meetings/:id/cancel');
//   }
// }

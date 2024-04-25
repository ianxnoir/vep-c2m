import { HttpModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import { configuration } from '../../../config';
import { DatabaseModule } from '../../../core/database/database.providers';
import { UtilsModule } from '../../../core/utils/utils';
import { GetMeetingsDtoStatus } from '../../../dto/getMeetings.dto';
import { Meeting } from '../../../entities/meeting.entity';
import { VideoConference } from '../../../entities/videoConference.entity';
import { ApiFairService } from '../../api/fair/fair.service';
import { MeetingService } from './meeting.service';

describe('MeetingService', () => {
  let module: TestingModule;
  let service: MeetingService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        DatabaseModule,
        HttpModule,
        UtilsModule,
        TypeOrmModule.forFeature([Meeting, VideoConference]),
      ],
      providers: [MeetingService, ApiFairService],
    }).compile();

    service = module.get<MeetingService>(MeetingService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('retrieve pending meetings by dummy user id 10000', async () => {
    const results = await service.paginateByConditions('10000', GetMeetingsDtoStatus.PENDING_SELF_RESPOND, ['fair-master'], {}, 1, 25);
    expect(results).toBeDefined();
  });
});

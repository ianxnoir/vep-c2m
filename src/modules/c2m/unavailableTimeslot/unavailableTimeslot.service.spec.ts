import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import moment from 'moment';

import { configuration } from '../../../config';
import { DatabaseModule } from '../../../core/database/database.providers';
import { UnavailableTimeslot } from '../../../entities/unavailableTimeslot.entity';
import { UserMeta } from '../../../entities/userMeta';
import { UnavailableTimeslotService } from './unavailableTimeslot.service';

describe('UnavailableTimeslotService', () => {
  let module: TestingModule;
  let service: UnavailableTimeslotService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        DatabaseModule,
        TypeOrmModule.forFeature([UnavailableTimeslot, UserMeta]),
      ],
      providers: [UnavailableTimeslotService],
    }).compile();

    service = module.get<UnavailableTimeslotService>(UnavailableTimeslotService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('retrieve unavailable timeslots by multiple dummy ssouids', async () => {
    const results = await service.findUnavailableTimeslotsByUsers(['10000', '10001'], [], {});
    expect(Array.isArray(results)).toBeTruthy();
  });

  it('creata time slots with', async () => {
    let UnavailableTimeslotDto = [{ startTime: moment(new Date()).toISOString(), endTime: moment(new Date()).add(30, 'minute').toISOString() }];
    let unavailableTimeslots = await service.createUnavailableTimeslots('1000', 'test', UnavailableTimeslotDto);
    expect(unavailableTimeslots).toBeDefined();
  });

  it('delete the specific time slots', async () => {
    let UnavailableTimeslotDto = [moment()];
    let deleteUnavailableTimeslots = await service.deleteUnavailableTimeslots('1000', 'test', UnavailableTimeslotDto);
    expect(deleteUnavailableTimeslots).toBeTruthy();
  });
});

import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configuration } from '../../../config';
import { DatabaseModule } from '../../../core/database/database.providers';
import { HiddenRecord } from '../../../entities/hiddenRecord.entity';
import { HiddenRecordService } from './hiddenRecord.service';

describe('HiddenRecordsService', () => {
  let module: TestingModule;
  let service: HiddenRecordService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), DatabaseModule, TypeOrmModule.forFeature([HiddenRecord])],
      providers: [HiddenRecordService],
    }).compile();

    service = module.get<HiddenRecordService>(HiddenRecordService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('Hidden Record function is able to call', async () => {
    const results = await service.find({ fairCode: 'fairCode', fairYear: 'fairYear', ssoUid: 'testId', hiddenType: 1 });
    expect(Array.isArray(results)).toBeTruthy();
  });
});

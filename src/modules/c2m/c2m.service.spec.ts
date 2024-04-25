import { HttpModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configuration } from '../../config';
import { DatabaseModule } from '../../core/database/database.providers';
import { UserMeta } from '../../entities/userMeta';
import { FairModule } from '../api/fair/fair.module';
import { C2MService } from './c2m.service';

describe('C2MService', () => {
  let service: C2MService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        HttpModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        FairModule,
        DatabaseModule,
        TypeOrmModule.forFeature([UserMeta]),
      ],
      providers: [C2MService],
    }).compile();

    service = module.get<C2MService>(C2MService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('Verify getDummyData has hello properties and value is world', () => {
    const dummyData = service.getDummyData();

    expect('hello' in dummyData).toBe(true);
    expect(dummyData.hello).toBe('world');
  });
});

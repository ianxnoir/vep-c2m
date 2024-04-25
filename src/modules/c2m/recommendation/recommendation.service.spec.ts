import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configuration } from '../../../config';
import { DatabaseModule } from '../../../core/database/database.providers';
import { Recommendation } from '../../../entities/recommendation.entity';
import { RecommendationService } from './recommendation.service';

describe('recommendaionService', () => {
  let module: TestingModule;
  let service: RecommendationService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), DatabaseModule, TypeOrmModule.forFeature([Recommendation])],
      providers: [RecommendationService],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('recommendation service is able to call', async () => {
    const results = await service.find({ fairCode: 'fair-master', fairYear: '2021' });
    expect(Array.isArray(results)).toBeTruthy();
  });
});

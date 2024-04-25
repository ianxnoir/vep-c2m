import { HttpModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HiddenRecord } from '../../../entities/hiddenRecord.entity';
import { HiddenRecordController } from './hiddenRecord.controller';
import { HiddenRecordService } from './hiddenRecord.service';
import { ApiFairService } from '../../api/fair/fair.service';
import { ElasticacheClusterModule } from '../../../core/elasticachecluster/elasticachecluster.providers';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([HiddenRecord]), ElasticacheClusterModule],
  providers: [HiddenRecordService, ApiFairService],
  controllers: [HiddenRecordController],
  exports: [HiddenRecordService],
})
export class HiddenRecordModule {}

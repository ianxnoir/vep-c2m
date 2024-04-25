import { HttpModule, Module } from '@nestjs/common';
import { ElasticacheClusterModule } from '../../../core/elasticachecluster/elasticachecluster.providers';
import { ApiFairService } from './fair.service';

@Module({
  imports: [HttpModule, ElasticacheClusterModule],
  providers: [ApiFairService],
  exports: [ApiFairService],
})
export class FairModule {}

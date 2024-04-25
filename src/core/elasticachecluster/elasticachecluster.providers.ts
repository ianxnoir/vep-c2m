import { ElasticacheClusterService } from './elasticachecluster.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [ElasticacheClusterService],
  exports: [ElasticacheClusterService]
})
export class ElasticacheClusterModule {}

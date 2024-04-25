import { HttpModule, Module } from '@nestjs/common';
import { ElasticacheClusterModule } from '../../../core/elasticachecluster/elasticachecluster.providers';
import { UtilsModule } from '../../../core/utils/utils';
import { ContentApiModule } from '../../api/content/content.module';
import { ApiFairService } from '../../api/fair/fair.service';

import { FairModule } from '../fair/fair.module';
import { BuyerService } from './buyer.service';

@Module({
  imports: [
    HttpModule,
    UtilsModule,
    FairModule,
    ContentApiModule,
    ElasticacheClusterModule
  ],
  exports: [BuyerService],
  providers: [BuyerService, ApiFairService],
})
export class BuyerModule {}

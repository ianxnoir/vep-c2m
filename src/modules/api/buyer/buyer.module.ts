import { HttpModule, Module } from '@nestjs/common';
import { BuyerService } from './buyer.service';

@Module({
  imports: [HttpModule],
  providers: [BuyerService],
  exports: [BuyerService],
})
export class BuyerModuleForEmailProfile {}

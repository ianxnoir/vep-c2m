import { HttpModule, Module } from '@nestjs/common';
import { EMPService } from './emp.service';

@Module({
  imports: [HttpModule],
  providers: [EMPService],
  exports: [EMPService],
})
export class EMPModule {}

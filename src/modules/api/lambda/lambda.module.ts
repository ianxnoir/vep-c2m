import { HttpModule, Module } from '@nestjs/common';
import { LambdaService } from './lambda.service';

@Module({
  imports: [HttpModule],
  providers: [LambdaService],
  exports: [LambdaService],
})
export class LambdaModule {}

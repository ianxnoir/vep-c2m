import { HttpModule, Module } from '@nestjs/common';
import { ContentApiService } from './content.service';

@Module({
  imports: [HttpModule],
  providers: [ContentApiService],
  exports: [ContentApiService],
})
export class ContentApiModule {}

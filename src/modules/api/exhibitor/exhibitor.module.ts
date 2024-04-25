import { HttpModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from '../../../config';
import { ApiExhibitorService } from './exhibitor.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
  providers: [ApiExhibitorService],
  exports: [ApiExhibitorService],
})
export class ExhibitorModule {}

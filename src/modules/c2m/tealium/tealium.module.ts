import { Module, HttpModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from '../../../entities/meeting.entity';
import { ContentApiModule } from '../../api/content/content.module';
import { ExhibitorModule } from '../../api/exhibitor/exhibitor.module';
import { TealiumController } from './tealium.controller';
import { TealiumService } from './tealium.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Meeting]),
    ExhibitorModule,
    ContentApiModule
  ],
  controllers: [TealiumController],
  providers: [TealiumService],
})
export class TealiumModule {}

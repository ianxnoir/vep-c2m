import { Module, HttpModule } from '@nestjs/common';
import { ContentApiModule } from '../api/content/content.module';
import { ChatroomController } from './chatroom.controller';

@Module({
  imports: [
    HttpModule,
    ContentApiModule,
  ],
  controllers: [ChatroomController],
  providers: [],
})
export class ChatroomModule {}

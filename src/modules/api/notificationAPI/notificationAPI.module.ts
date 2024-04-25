import { HttpModule, Module } from '@nestjs/common';
import { NotificationAPIService } from './notificationAPI.service';

@Module({
  imports: [HttpModule],
  providers: [NotificationAPIService],
  exports: [NotificationAPIService],
})
export class NotificationAPIModule {}

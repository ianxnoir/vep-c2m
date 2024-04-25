import { HttpModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ZoomService } from './zoom.service';

@Module({
  imports: [
    HttpModule,
    // Use JWT service for sign zoom request token
    JwtModule.register({ secret: 'tYIxDHAlWh4vSelLs6zsIeGpH33u1O1TgQGR' }),
  ],
  providers: [ZoomService],
  exports: [ZoomService],
})
export class ZoomModule {}

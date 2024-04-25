import { Body, Controller, Post } from '@nestjs/common';
import { TealiumService } from './tealium.service';
import { Logger } from '../../../core/utils/logger.service';

@Controller('tealium')
export class TealiumController {
  constructor(
    private logger: Logger,
    private tealiumService: TealiumService
  ) {}

  @Post('/getExhibitorDataByMeetingId')
  public getExhibitorDataByMeetingId(@Body() body: Record<string, any>): Record<string, any> {
    const { meetingId, exhibitorUrn, fairCode } = body;
    this.logger.log(`action: "getExhibitorDataByMeetingId - POST - tealium/getExhibitorDataByMeetingId - start", step: "1", detail: ${JSON.stringify(body)}})`);
    return this.tealiumService.getExhibitorDataByMeetingId({ meetingId, exhibitorUrn, fairCode });
  }
}

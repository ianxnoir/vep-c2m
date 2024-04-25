import { Body, Controller, Post } from '@nestjs/common';
import { Logger } from '../../core/utils';
import { ContentApiService } from '../api/content/content.service';

@Controller('chatroom')
export class ChatroomController {
  constructor(
    private logger: Logger,
    private contentApiService: ContentApiService
  ) {}

  @Post('/checkSensitiveWord')
  public checkSensitiveWord(@Body('word') word: string) {
    return this.contentApiService.checkSensitiveWord(word)
    .then(result => {
      this.logger.log(JSON.stringify({action: "checkSensitiveWord - POST - checkSensitiveWord/:word", section: "c2m - chatroom", step: "success", detail: result.data}));

      let pass = true;
      if (result.data?.data?.senskwblockedwords) {
        pass = false;
      }
      return {
        status: 200,
        result: {
          pass
        }
      };
    })
    .catch(error => {
      this.logger.log(JSON.stringify({action: "checkSensitiveWord - POST - checkSensitiveWord/:word", section: "c2m - chatroom", step: "fail", detail: error}));
      return {
        status: 400,
        error: error?.message ?? JSON.stringify(error)
      };
    })
  }
}

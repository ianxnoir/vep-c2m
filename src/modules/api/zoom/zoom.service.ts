import { HttpService, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '../../../core/utils';

@Injectable()
export class ZoomService {
  private apiHost: string = 'https://api.zoom.us/v2';

  constructor(private httpService: HttpService, private jwtService: JwtService, private logger: Logger) {}

  public async createMeeting(data: Record<string, any> = {}): Promise<any> {
    const headers = this.makeHeaders();
    const result: Record<string, any> = await this.httpService.post(`${this.apiHost}/users/${data.accountEmail}/meetings`, data, { headers }).toPromise();

    return result.data;
  }

  public async deleteMeeting(zoomMeetingId: string): Promise<any> {
    this.logger.log(JSON.stringify({ section: 'zoom', action: 'endVideoConfernece- fairs/:fairCode/meetings/:id/video-conference', step: '1', detail: { zoomMeetingId } }));
    const zoomMeetingApiUrl = `${this.apiHost}/meetings/${zoomMeetingId}`;
    const headers = this.makeHeaders();

    this.logger.log(JSON.stringify({ section: 'zoom', action: 'endVideoConfernece- fairs/:fairCode/meetings/:id/video-conference', step: '2', detail: { zoomMeetingId, zoomMeetingApiUrl, headers }}));
    // First update Zoom meeting status to ended
    const endMeetingResponse = await this.httpService.put(`${zoomMeetingApiUrl}/status`, { action: 'end' }, { headers }).toPromise();
    this.logger.log(JSON.stringify({ section: 'zoom', action: 'endVideoConfernece- fairs/:fairCode/meetings/:id/video-conference', step: '2.1', detail: { endMeetingResponse } }));
    if (endMeetingResponse.status !== 204) {
      return endMeetingResponse;
    }

    // Then delete it
    return this.httpService.delete(`${zoomMeetingApiUrl}`, { headers }).toPromise();
  }

  private makeHeaders(): Record<string, any> {
    const token = this.signToken();

    return { Authorization: `Bearer ${token}` };
  }

  private signToken(): string {
    const zoomApiKey = 'ARXgsE9oTGyCDTV53B8rKA';

    return this.jwtService.sign({
      iss: zoomApiKey,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    });
  }
}

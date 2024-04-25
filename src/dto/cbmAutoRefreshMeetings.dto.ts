import { IsString } from 'class-validator';

export class CBMAutoRefreshMeetingsDtoData {
  @IsString({ each: true })
  public meetingIds!: string[];
}

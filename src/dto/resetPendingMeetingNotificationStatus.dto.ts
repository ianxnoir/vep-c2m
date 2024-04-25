import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPendingMeetingNotificationStatus {
  @IsNotEmpty()
  @IsString()
  public oldUserId!: string;

  @IsNotEmpty()
  @IsString()
  public newUserId!: string;
}

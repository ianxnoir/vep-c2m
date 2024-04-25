import { IsEnum, IsNotEmpty } from 'class-validator';
import { NotificationTemplatesId, NotificationType } from '../modules/c2m/notification/notification.type';

export class HandleNotificationForSeminarDto {
  @IsNotEmpty()
  @IsEnum(NotificationTemplatesId)
  public templateId!:NotificationTemplatesId;

  @IsNotEmpty()
  @IsEnum(NotificationType)
  public notificationType!: NotificationType;

  @IsNotEmpty()
  public seminarData!: any;

  @IsNotEmpty()
  public skipWebNotifiction!: boolean;
}

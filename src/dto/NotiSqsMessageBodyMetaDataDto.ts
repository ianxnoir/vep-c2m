import { IsNotEmpty, IsOptional } from "class-validator";

export enum NotificationGroup {
    seminar = "seminar",
    meeting = "meeting",
    fair = "fair"
  }

export class NotiSqsMessageBodyMetaDataDto {
    @IsOptional()
    public from!: string;             

    @IsOptional()
    public fromName!: string;         

    @IsOptional()
    public cc!: string;

    @IsOptional()
    public language!: string; 

    @IsOptional()
    public emailHeader!: string;

    @IsOptional()
    public emailFooter!: string;

    @IsOptional()
    public fairCode!: string;

    @IsOptional()
    public ssoUid!: string;  

    @IsOptional()
    public companyCcdId!: string;

    @IsOptional()
    public toRole!: string;

    @IsOptional()
    public year!: string;

    @IsOptional()
    public urlLink!: string;
    
    @IsOptional()
    public notificationType!: NotificationGroup | ''; 

    @IsNotEmpty()
    public userActivity!: {
        [key: string]: any
    };
}

export class NotiSqsMessageBodyDto {
    @IsNotEmpty()
    public notiVersion!: string;       

    @IsNotEmpty()
    public MessageGroupId!: string;

    @IsNotEmpty()
    public emailIds!: string[]; 

    @IsNotEmpty()
    public templateId!: number;        

    @IsNotEmpty()
    public channels!: string[];

    @IsNotEmpty()
    public templateSource!: string;

    @IsNotEmpty()
    public queueType!: string;          

    @IsNotEmpty()
    public placeholders!: {
      [key: string]: string
    };

    @IsNotEmpty()
    public metaData!: NotiSqsMessageBodyMetaDataDto
}
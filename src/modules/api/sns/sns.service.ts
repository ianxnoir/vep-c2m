import { v4 as uuidv4 } from "uuid";
import AWS from 'aws-sdk';
import { ConfigService } from "@nestjs/config";
import { Injectable, Logger } from "@nestjs/common";

import { MessageAttributeMap } from "aws-sdk/clients/sns";

import { NotiSqsMessageBodyDto } from "../../../dto/NotiSqsMessageBodyMetaDataDto";
var sns = new AWS.SNS({ region: 'ap-east-1' });
@Injectable()
export class SnsService {
    private messageGroupId: string;
    private notiSNSTopicArn: string;
    constructor(
        private configService: ConfigService, 
        private logger: Logger
    ) {
        this.logger.setContext(SnsService.name);
        this.notiSNSTopicArn = this.configService.get<string>('notiSNSTopicArn') || '';
        this.messageGroupId = uuidv4()
    }

    public async sendMsgToSnsQueue(msgBody: NotiSqsMessageBodyDto, messageAttributes: MessageAttributeMap) {
        let snsParam: AWS.SNS.PublishInput = {
            MessageDeduplicationId: uuidv4(),
            MessageGroupId: msgBody.MessageGroupId || this.messageGroupId,
            TopicArn: this.notiSNSTopicArn,
            Message: JSON.stringify(msgBody),
            MessageAttributes: messageAttributes
        };
        this.logger.log("snsParam")
        this.logger.log(snsParam)
        let result = await sns.publish(snsParam).promise();
        this.logger.log(result)
        const { MessageDeduplicationId } = snsParam
        return {...result, MessageDeduplicationId};
    }

    public async sendNotificationBySns(msgBody: NotiSqsMessageBodyDto, channels: string[], queueType: string) {
        let messageAttributes = {
            channels: {
                DataType: "String.Array",
                StringValue: JSON.stringify(channels)
            },
            queueType: {
                DataType: "String",
                StringValue: queueType
            },
        };

        this.logger.log(JSON.stringify({ section: 'sendMessageToSns', action: `msgBody: ${msgBody ?? JSON.stringify(msgBody)}, messageAttributes: ${messageAttributes ?? JSON.stringify(messageAttributes)}`, step: '2' }));
        return this.sendMsgToSnsQueue(msgBody, messageAttributes);
    }
}
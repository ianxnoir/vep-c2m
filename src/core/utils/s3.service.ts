import S3 from 'aws-sdk/clients/s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<any>('s3.bucket');
    this.accessKeyId = this.configService.get<any>('s3.accessKeyId');
    this.secretAccessKey = this.configService.get<any>('s3.secretAccessKey');
    this.region = this.configService.get<any>('s3.region');
  }

  public async getFile(path: string) {
    try {
      const params = { Bucket: this.bucket, Key: path };
      return (await this.getS3Bucket().getObject(params).promise()).Body.toString('utf-8');
      // return data;
    } catch (err) {
      console.log(err);
      return { error: 'file not found' };
    }
  }

  private getS3Bucket(): any {
    return new S3({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
    });
  }
}

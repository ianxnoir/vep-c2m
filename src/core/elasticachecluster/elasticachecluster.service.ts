import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class ElasticacheClusterService {
  private client: any;
  constructor(
    private configService: ConfigService,
    ) {
    this.setClient("meeting");
  }

  setClient(name: string) {
    const redisConfig = this.configService.get<any>("redis")?.find((config: any) => config.name === name);

    this.client = new Redis.Cluster([
      {
        port: redisConfig?.port || "",
        host: redisConfig?.host || "",
      },
    ], {
      dnsLookup: (address, callback) => callback(null, address),
      redisOptions: {
        tls: {},
        password: redisConfig?.password || "",
      },
    });
  }

  public getCache(key : string): Promise<any> {
    return this.client.get(key);
  }

  public setCache(key : string, value : number | string, expireIn : number = 0): Promise<any> {
    if (expireIn) {
      return this.client.set(key, value, "ex", expireIn); // ex = seconds
    }
    return this.client.set(key,value);
  }

  // without unmanageable throw
  getKeysByPattern = (pattern: string): Promise<any> => {
    return this.client.keys(pattern);
  }

    // without unmanageable throw
  deleteCacheByKey = (key: string): Promise<any> => {
    return this.client.del(key);
  }
}
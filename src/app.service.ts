import {Injectable, OnApplicationBootstrap} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {Server} from "http";

@Injectable()
export class AppService implements OnApplicationBootstrap {
    constructor(private readonly refHost: HttpAdapterHost<any>) { }

    onApplicationBootstrap() {
        const server: Server = this.refHost.httpAdapter.getHttpServer();
        server.keepAliveTimeout = 65000;
        server.headersTimeout = 65000;
    }
}

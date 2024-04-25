import { Injectable, NestInterceptor, ExecutionContext, CallHandler} from '@nestjs/common';
import { Observable} from 'rxjs';
import * as AWSXRay from 'aws-xray-sdk';

@Injectable()
export class XRayInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest()
        AWSXRay.getSegment()?.addAnnotation('x_request_id',req.headers['x-request-id']??'')
        return next.handle().pipe();
    };
};
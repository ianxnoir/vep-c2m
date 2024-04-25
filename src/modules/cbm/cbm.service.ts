import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '../../core/utils';
import { C2mConfigEntity } from '../../entities/c2mConfig.entity';

// Todo: group buyer/ exhibitor function into a service
@Injectable()
export class CBMService {
    constructor(
        @InjectRepository(C2mConfigEntity)
        private c2mConfigEntity: Repository<C2mConfigEntity>,
        private logger: Logger
    ) {}

    public async createConfigRecord({ fieldName, unit, configValue, lastUpdatedBy }: Record<string, any>) {
        this.logger.log(JSON.stringify({ action: 'create', section: 'c2m configuration', step: '1', detail: { fieldName, unit, configValue, lastUpdatedBy } }));
        return this.c2mConfigEntity.save({ fieldName, unit, configValue, lastUpdatedBy, lastUpdatedAt: new Date() });
    }

    public async getConfigValue({ page, count }: Record<string, any>) {
        this.logger.log(JSON.stringify({ action: 'get', section: 'c2m configuration', step: '1', detail: { page, count } }));
        return this.c2mConfigEntity.createQueryBuilder('config')
        .take(count)
        .skip((page - 1) * count)
        .getMany()
        .then((result: any) => {
            this.logger.log(JSON.stringify({ action: 'get', section: 'c2m configuration', step: '2', detail: result }));
            if (!result.length) {
                return Promise.reject({
                    status: 400,
                    message: 'get c2mConfig table error'
                });
            }
            return {
                status: 200,
                data: result,
                message: `get c2m config values in ${page} page from c2mConfig table successfully`
            };
        })
        .catch((error: any) => {
            this.logger.log(JSON.stringify({ action: 'get', section: 'c2m configuration', step: 'error', detail: error }));
            return {
                status: error?.status ?? 400,
                message: error?.message ?? JSON.stringify(error)
            };
        });
    }

    public async updateConfigValue({ id, configValue, lastUpdatedBy }: Record<string, any>) {
        this.logger.log(JSON.stringify({ action: 'update', section: 'c2m configuration', step: '1', detail: { id, configValue, lastUpdatedBy } }));
        return this.c2mConfigEntity.update(
            {
                id
            },
            {
                configValue,
                lastUpdatedBy,
                lastUpdatedAt: new Date()
            }
        )
        .then((result: any) => {
            this.logger.log(JSON.stringify({ action: 'update', section: 'c2m configuration', step: '2', detail: result }));
            if (!result) {
                return Promise.reject({
                    status: 400,
                    message: 'update c2mConfig table error'
                });
            }

            return {
                status: 200,
                data: {
                    id,
                    configValue,
                    lastUpdatedBy
                },
                message: `updated ID${id} config to ${configValue} by ${lastUpdatedBy} in c2mConfig table successfully`
            };
        })
        .catch((error: any) => {
            this.logger.log(JSON.stringify({ action: 'update', section: 'c2m configuration', step: 'error', detail: error }));
            return {
                status: error?.status ?? 400,
                message: error?.message ?? JSON.stringify(error)
            };
        });
    }

//   public async updateConfigValueMulti({ configId, configValue, lastUpdatedBy }: Record<string, any>) {
//     this.logger.log(JSON.stringify({ action: 'update', section: 'c2m configuration', step: '1', detail: { configId, configValue, lastUpdatedBy } }));

//     const updatePromise: Promise<any>[] = [];

//     dataArray.forEach((data) => {
//         updatePromise.push(
//             this.c2mConfigEntity.update(
//                 {
//                   notificationType: data.nnn,
//                   channelType,
//                   unit
//                 },
//                 {
//                   configValue
//                 }
//               )
//               .then((result: any) => {
//                   this.logger.log(JSON.stringify({ action: 'update', section: 'c2m configuration', step: '1', detail: result }));
//                   if (!result) {
//                       return Promise.reject({
//                           status: 400,
//                           data: {
//                             notificationType,
//                             channelType,
//                             unit,
//                             configValue
//                           },
//                           message: 'update c2mConfig table error'
//                       });
//                     }

//                   return Promise.resolve({
//                       status: 200,
//                       data: {
//                           notificationType,
//                           channelType,
//                           unit,
//                           configValue
//                       },
//                       message: `updated ${notificationType} ${channelType} to ${configValue} ${unit} in c2mConfig table successfully`
//                   });
//               })
//               .catch((error) => {
//                   this.logger.log(JSON.stringify({ action: 'update', section: 'c2m configuration', step: 'error', detail: error }));
//                   return Promise.resolve({
//                       status: error?.status ?? 400,
//                       data: {
//                         notificationType,
//                         channelType,
//                         unit,
//                         configValue
//                       },
//                       message: error?.message ?? JSON.stringify(error)
//                   });
//               })
//         );
//     });

//     return Promise.all(updatePromise)
//     .then(result => {
//         this.logger.log(JSON.stringify({ action: 'update', section: 'c2m configuration', step: 'error', detail: error }));
//         // result.forEach(res => {
//         //     if (res.status !== 200) {
//         //         return {
//         //             status: 400
//         //         }
//         //     }
//         // })

//         return {
//             status: 200,
//             data: result
//         }
//     })
//     .catch(error => {
//         return {
//             status
//         }
//     })
//   }
}

import { TypeOrmModuleOptions } from "@nestjs/typeorm";

const getDBConfig = (dbConfig: Record<string, any>, dbName: string, entities?: any[]): TypeOrmModuleOptions => {
  if (dbConfig?.replication?.master && dbConfig?.replication?.slaves?.length) {
    Object.entries(dbConfig.replication).forEach(([key, value]: any) => {
      if (key === 'master') {
        value.database = dbName;
      }

      // must have at least one slave for the read replica, otherwise the typeorm will throw connection error
      if (key === 'slaves') {
        value.forEach((slave: Record<string, string>) => {
          slave.database = dbName;
        });
      }
    });
    return {
      type: 'mariadb',
      synchronize: false,
      autoLoadEntities: true,
      logging: true,
      timezone: 'Z',
      replication: dbConfig.replication,
      entities,
      extra: {
        connectionLimit: 30,
      },
    };
  }

  return {
    type: 'mariadb',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbName,
    entities
  };
};

export {
  getDBConfig
};

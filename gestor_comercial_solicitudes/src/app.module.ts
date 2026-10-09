import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RequestsModule } from './requests/requests.module.js';
import configuration from './config/configuration.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    RequestsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const dbType = config.get<string>('database.type');
        if (dbType === 'postgres') {
          return {
            type: 'postgres',
            host: config.get<string>('database.host'),
            port: config.get<number>('database.port'),
            username: config.get<string>('database.username'),
            password: config.get<string>('database.password'),
            database: config.get<string>('database.name'),
            autoLoadEntities: true,
            synchronize: true,
          } as unknown as TypeOrmModuleOptions;
        }

        return {
          type: 'better-sqlite3',
          database: config.get<string>('database.sqlitePath') || 'commercialization.sqlite',
          autoLoadEntities: true,
          synchronize: true,
        } as unknown as TypeOrmModuleOptions;
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

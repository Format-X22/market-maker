import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Candles, CandlesSchema } from './candles.schema';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
        }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService): MongooseModuleOptions => ({
                uri: configService.get<string>('ME_MONGO_CONNECT'),
            }),
            inject: [ConfigService],
        }),
        MongooseModule.forFeature([{ name: Candles.name, schema: CandlesSchema }]),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}

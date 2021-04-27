import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication } from '@nestjs/common';

const PORT: number = 3000;

async function bootstrap(): Promise<void> {
    const app: INestApplication = await NestFactory.create(AppModule);
    await app.listen(PORT);
}
bootstrap();

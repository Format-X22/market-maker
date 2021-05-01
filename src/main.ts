import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
    const app: INestApplication = await NestFactory.create(AppModule);
    const configService: ConfigService = app.get(ConfigService);
    const port: number = Number(configService.get<string>('ME_API_PORT'));

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
        }),
    );

    const swaggerConfig: ReturnType<DocumentBuilder['build']> = new DocumentBuilder()
        .setTitle('Unknown')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const documentation: OpenAPIObject = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api', app, documentation);

    await app.listen(port);
}
bootstrap();

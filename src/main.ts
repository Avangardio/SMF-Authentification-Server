import {NestFactory} from '@nestjs/core';
import {AppModule} from './App/app.module';
import * as cookieParser from 'cookie-parser';


async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.use(cookieParser());
    app.enableCors({origin: process.env.CLIENT_URL, credentials: true});
    await app.listen(process.env.PORT || 3333);
}

bootstrap().then(() => console.log('Running http://localhost:3333/'))

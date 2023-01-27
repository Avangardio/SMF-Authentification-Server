import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Users} from './DB/user.entity';
import {AuthService} from "./auth.service";
import {AuthController} from "./auth.controller";
import {JwtModule} from "@nestjs/jwt";
import {RedisModule} from "@liaoliaots/nestjs-redis";
import {ConfigModule} from "@nestjs/config";

@Module({
    imports: [
        //Подключаем орм с репозиторием Users
        TypeOrmModule.forFeature([Users]),
        //Подключаем .env файл
        ConfigModule.forRoot(),
        //Подключаем jwt модуль
        JwtModule.register({secret: process.env.SERVER_SECRET}),
        //Подключаем Редис модуль. Допустим будем в этом модуле использовать 4 базу данных
        RedisModule.forRoot({
            config: {
                host: 'localhost',
                port: 6379,
                db: 4
            }
        })
    ],
    controllers: [AuthController],
    providers: [AuthService],
})
export class AuthModule {
}
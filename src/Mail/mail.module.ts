import {Module} from '@nestjs/common';
import {MailerModule} from '@nestjs-modules/mailer';
import {HandlebarsAdapter} from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import {MailController} from './mail.controller';
import {MailService} from "./mail.service";
import {RedisModule} from '@liaoliaots/nestjs-redis';
import {JwtModule} from "@nestjs/jwt";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Users} from "../Auth/DB/user.entity";
import {ConfigModule} from "@nestjs/config";

@Module({
    imports: [
        //Подключаем .env файл
        ConfigModule.forRoot(),
        // Настройка почтовой службы, в данном случае гугл
        MailerModule.forRoot({
            transport: {
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: '465',
                secure: true,
                auth: {
                    user: process.env.MAIL_USER,
                    pass: process.env.MAIL_PASS,
                },
            },
            defaults: {
                from: '"SaveMyFinance" <no-reply@savemyfinance.app@gmail.com>',
            },
            template: {
                dir: __dirname + '/templates',
                adapter: new HandlebarsAdapter(),
                options: {
                    strict: true,
                },
            },
        }),
        // Подключаем редис. Допустим, будем использовать датабазу номер 3 для реквестов.
        RedisModule.forRoot({
            config: {
                host: 'localhost',
                port: 6379,
                db: 3
            }
        }),
        //Подключаем модуль jwt
        JwtModule.register({secret: process.env.SERVER_SECRET}),
        //Подключаем орм модуль с репозиторием Users
        TypeOrmModule.forFeature([Users])
    ],
    controllers: [MailController],
    providers: [MailService],
})
export class MailModule {
}

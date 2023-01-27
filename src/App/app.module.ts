import {Module} from '@nestjs/common';
import {MailModule} from "../Mail/mail.module";
import {AuthModule} from "../Auth/auth.module";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Users} from "../Auth/DB/user.entity";
import {ConfigModule} from "@nestjs/config";

@Module({
    imports: [
        //Импортируем мейлер модуль
        MailModule,
        //Импортируем логин модуль
        AuthModule,
        //Подключаем .env файл
        ConfigModule.forRoot(),
        //Подключаем орм
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST,
            port: 5432,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: 'users_db',
            entities: [Users],
            synchronize: false,
        }),
    ],
    controllers: [],
    providers: [],
})
export class AppModule {
}

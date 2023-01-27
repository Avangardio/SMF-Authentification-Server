import {Injectable} from '@nestjs/common';
import {MailerService} from '@nestjs-modules/mailer';
import {InjectRedis} from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import {InjectRepository} from "@nestjs/typeorm";
import {Users} from "../Auth/DB/user.entity";
import {Repository} from "typeorm";

//Вводная дата
type codeConfDto = {
    //имейл
    email: string
    //код подтверждения
    code: string
}

@Injectable()
export class MailService {
    constructor(private readonly mailerService: MailerService,
                @InjectRepository(Users) private repository: Repository<Users>,
                @InjectRedis() private readonly redis: Redis) {
    }


    public async initConfirmation(mail): Promise<any> {
        let number: string;
        //проверяем уникальность номера, если не уникален, повторяем генерацию
        do {
            number = `${Math.floor(100000 + Math.random() * 900000)}`;
        } while (await this.redis.get(`${mail}`) === number);
        //записываем код в аккаунт
        await this.redis.set(`${mail}`, `${number}`);
        //отправляем письмо
        this.mailerService
            .sendMail({
                to: `${mail}`, // list of receivers
                subject: 'Confirm your account.', // Subject line
                template: __dirname + '../../../../src/emails/confirmation',
                context: {
                    authCode: number,
                },
            })
            .catch((error) => console.log(error));
    }

    public async doneConfirmation(data: codeConfDto): Promise<number> {
        //получаем код из редиса по аккаунту как ключу
        const subject = await this.redis.get(`${data.email}`);
        //выбрасываем ошибку если введеный пользователем код невалидный
        if (subject !== data.code) throw new Error('Invalid Code');
        //В случае успеха обновляем статус user_confirmed на true, логируем возможные ошибки
        this.repository.query(`UPDATE users SET user_confirmed = true WHERE user_email = '${data.email}'`)
            .catch(error => console.log(error))
        //отправляем промис с удалением данных из редиса
        return this.redis.del(`${data.email}`);
    }

    //метод, отправляющий новый пароль пользователя
    public async sendInternalPasswordService(data: { email: string, password: string }) {
        //отправляем письмо пользователю с паролем для вннутренней аутентификации, ловим ошибки
        this.mailerService
            .sendMail({
                to: `${data.email}`, // list of receivers
                subject: 'Your internal service password.', // Subject line
                template: __dirname + '../../../../src/emails/newPassword',
                context: {
                    newPassword: data.password,
                },
            })
            .catch((error) => console.log(error));
    };

    //Метод, отправляющий код, проверяющий код
    public async passwordRecoveryService(data: { email: string, code?: string }) {
        if (data.code) {
            //получаем код по имейлу
            const redisCode = await this.redis.get(`recovery:${data.email}`);
            //возвращаем сверку
            if (redisCode !== data.code) throw new Error('Code is not correct');
            return;
        }
        ;
        //если нет кода, создаем и отправляем код
        let number: string;
        //проверяем уникальность номера, если не уникален, повторяем генерацию
        do {
            number = `${Math.floor(100000 + Math.random() * 900000)}`;
        } while (await this.redis.get(`recovery:${data.email}`) === number);
        //добавляем код в редис
        await this.redis.set(`recovery:${data.email}`, `${number}`);
        //отправляем письмо с кодом, резолва не ждем
        this.mailerService
            .sendMail({
                to: `${data.email}`, // list of receivers
                subject: 'Your code to update password.', // Subject line
                template: __dirname + '../../../../src/emails/PasswordRecovery',
                context: {
                    code: number,
                },
            })
            .catch((error) => console.log(error));
    }
}

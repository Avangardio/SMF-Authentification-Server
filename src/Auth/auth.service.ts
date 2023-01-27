import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {Users} from './DB/user.entity';
import * as bcrypt from 'bcrypt';
import {InjectRedis} from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";

//Regex для верификации почты, критерии: - цифры буквы @почта.домен
const emailRegex = '^[a-zA-Z0-9.]+@[a-zA-Z0-9]+\\.[a-zA-Z]+$';
//Regex для верификации пароля, критерии: - Как минимум одна буква и цифра, как минимум 7 разрешенных символа
const passwordRegex = '^(?=.+[0-9])(?=.+[a-zA-Z])(?:[a-zA-Z0-9~!@#$%^&*()_+=-]+){7,}$';
//Regex для верификации никнейма, критерии: - Как минимум 3 разрешенных символа
const nicknameRegex = '^[a-zA-Z0-9]{3,}$';

type accountBody = {
    email: string
    password?: string
    nickname?: string
}

@Injectable()
export class AuthService {
    constructor(@InjectRepository(Users) private repository: Repository<Users>,
                @InjectRedis() private readonly redis: Redis) {
    }

    //Функция для валидации данных, возвращает boolean
    validation(string: string, option: string): boolean {
        //Валидация почты
        if (option === 'email') return new RegExp(emailRegex).test(string);
        //Валидация пароля
        if (option === 'password') return new RegExp(passwordRegex).test(string);
        //Валидация Никнейма
        if (option === 'nickname') return new RegExp(nicknameRegex).test(string);
    }

    //Отвечает за регистрацию через внутренний сервис (пароль, логин, никнейм)
    async registration(token, data: accountBody): Promise<string> {
        //Проводим валиацию для каждого пункта даты, при первом false выбрасываем ошибку с ошибкой валидации
        for (const [option, string] of Object.entries(data)) {
            if (!this.validation(string, option)) throw new Error('Validation error.');
        }
        ;
        //Проверяем, есть ли пользователь в БД, и НЕ подтвержден!!!, тогда можно перезаписать
        const user = await this.repository.query(`SELECT user_email FROM users WHERE user_email = '${data.email}' AND user_confirmed = true`);
        if (user.length != 0) throw new Error('User already exists.');
        //Генерируем хэш из пароля, функция ждет резолва.
        const hash = await bcrypt.hash(data.password, 10);
        //Добавляем для текущего токена имеил, чтоб пидорасы не отсылали на другие почты реквесты.
        await this.redis.set(token, data.email);
        //Возвращаем Промис который НЕ ждем, функция добавляет пользователя в базу данных
        //Кваери либо добавляет нового пользователя, либо обновляет неподтвержденного.
        return this.repository.query(`INSERT INTO users (user_nickname, user_email, user_password) VALUES
                            ('${data.nickname}', '${data.email}', '${hash}')
                            ON CONFLICT (user_email)
                            DO UPDATE SET user_password = '${hash}', user_nickname = '${data.nickname}'`
        );
    }

    //Метод, отвечающая за проверку данных пользователя, и добавление токена к имейлу
    async login_service(query: { email: string, password: string, token: string }): Promise<boolean | any> {
        //Получаем пользователя
        const user = await this.repository.query(`SELECT user_email, user_password, user_nickname FROM users WHERE user_email = '${query.email}' AND user_confirmed = true`)
            .catch(error => console.log(error));
        if (user.length === 0) return false;
        //сравниваем пароль с хешем
        const match = await bcrypt.compare(query.password, user[0].user_password);
        //если есть совпадение, добавляем токен
        if (match) {
            //прикрепляем токен
            await this.redis.set(query.token, query.email);
            //возвращаем тру
            return user[0];
        }
        //если нет мэтча
        if (!match) {
            return false;
        }
        //если была ошибка
        return false;
    }

    //Метод, ответственная за добавлению в базу данных редиса токена, который нужен для защиты
    async credentialsLoginService(uuid: string, email: string | null): Promise<string> {
        //навсякий удаляем айди из редиса.
        await this.redis.del(uuid);
        //Добавляет токен в базу данных редиса, добавляем в него почту если пользователь есть, иначе ''.
        return this.redis.set(uuid, email ? email : '');
    }

    //Метод, отвественная за аутентификацию пользователя через внешние сервисы
    async externalLoginService(data: accountBody, uuid: string): Promise<{ email: string, nickname: string, newPassword?: string }> {
        //Создаем хеш из сгенерированного пароля
        const hash = await bcrypt.hash(uuid, 10);
        //Ищем, зарегистрирован ли был данный пользователь до логина через внешний сервис, если находит, идем дальше
        const user = await this.repository.query(`SELECT * FROM users WHERE user_email = '${data.email}' AND user_confirmed = true`);
        if (user.length > 0) {
            //Если пользователь существует, то просто возвращаем никнейм и пароль
            return {nickname: user[0].user_nickname, email: user[0].user_email};
        }
        //Создаем пользователя в базе данных пользователей УЖЕ АКТИВИРОВАННЫМ, либо обновляет неподтвержденного. резолв jdem
        await this.repository.query(`INSERT INTO users (user_nickname, user_email, user_password, user_confirmed) VALUES
                            ('${data.nickname}', '${data.email}', '${hash}', true)
                            ON CONFLICT (user_email)
                            DO UPDATE SET user_password = '${hash}', user_nickname = '${data.nickname}'`
        );
        const newUser = await this.repository.query(`SELECT * FROM users WHERE user_email = '${data.email}'`)
        //В случае нового пользователя, отправляем никнейм, имейл и новый пароль, чтобы контроллер потом отправил его пользователю.
        return {nickname: newUser[0].user_nickname, email: newUser[0].user_email, newPassword: uuid};
    }

    //Метод для малидации токена, отправленное с реквестом
    async validateToken(token: string): Promise<string> {
        //Пытаемся получить имеил с токена
        const email = await this.redis.get(token);
        //Если его нет, выбрасываем ошибку
        if (!email) throw new Error('Invalid Token!');
        //В случае успеха, возвращаем почту
        return email;
    }

    //Метод для получения данных о пользователе и его изменения
    async requestToMailer_recoveryService({email, password}: { email: string, password?: string }) {
        //ищем пользователя, обязательно подтвержденного
        const user = await this.repository.query(`SELECT * FROM users WHERE user_email = '${email}' AND user_confirmed = true`);
        //если такового нет, выбрасываем ошибку.
        if (user.length === 0) throw new Error('User does not exists');
        //если нет пароля, то возвращаем имейл, иначе продолжаем
        if (!password) return email;
        //Криптуем пользовательский пароль.
        const hash = await bcrypt.hash(password, 10);
        //Обновляем пароль пользователя, он точно должен быть
        this.repository.query(`UPDATE users SET user_password = '${hash}' WHERE user_email = '${email}'`);
    }

    //Метод для регистарции польователя в таблице
    async doneConfirmation_service(email: string) {
        this.repository.query(
            `CREATE TABLE IF NOT EXISTS "table:${email}" (
              action_id SERIAL PRIMARY KEY,
              action_date VARCHAR NOT NULL,
              action_name VARCHAR NOT NULL,
              action_description VARCHAR,
              action_type INT NOT NULL,
              action_amount INT NOT NULL,
              action_currency VARCHAR NOT NULL
        )`);
    }

}

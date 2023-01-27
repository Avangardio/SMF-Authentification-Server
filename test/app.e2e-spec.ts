import {Test, TestingModule} from '@nestjs/testing';
import {INestApplication} from '@nestjs/common';
import * as request from 'supertest';
import {AppModule} from '../src/App/app.module';
import * as cookieParser from 'cookie-parser';


//E-2E ТЕСТ ЛОГИН СЕРВЕРА
describe('Auth Server (e2e)', () => {
        //Подключаем эпп
        let app: INestApplication;

        //Перед каждым тестом пересобирает сервер
        beforeEach(async () => {
            //Создаем тестовый модуль
            const moduleFixture: TestingModule = await Test.createTestingModule({
                //Импортируем главный модуль сервера
                imports: [AppModule],
                //Компилируем
            })
                .compile();
            //Создаем приложение
            app = moduleFixture.createNestApplication();
            //Подключаем куки парсер
            app.use(cookieParser());
            //Запускаем его
            await app.init();
        });

    //Для этих тестов я буду использовать уже подписанные jwt куки, так как тест именно финансового сервера
    //todo - прописать сюда куки на сто лет
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50Ijp7ImVtYWlsIjoiYXZhbmdhcmRpbzE0NThAZ21haWwuY29tIiwibmlja25hbWUiOiLQkNGA0YLRkdC8INCR0LXQu9GP0L3QuNC9In0sImlhdCI6MTY3NDUxMDk2OCwiZXhwIjoxNjg3NDcwOTY4fQ.SlDkd1CUm4rVhsMMYPwK8_F7bFxbCr6xpZJTG7ULugQ'
    //ОБЬЯВЛЯЕМ ЗАГЛУШКУ ДЛЯ ТОКЕНА
    let token: string = 'testToken'
    //ОБЪЯВЛЯЕМ РАНДОМНЫЙ ИМЕЙЛ
    let email: string = `emailbody1${Math.floor(Math.random() * 1000)}@gmail.ru`
    //Первый тест - пост запрос на регистрацию, тело запроса - неправильно
    it('[AUTH] - (1) - /registration (POST) [НЕПРАВИЛЬНОЕ ТЕЛО]', () => {
        return request(app.getHttpServer())
            //Отправляем запрос
            .post('/auth/registration')
            //Прописываем заголовки
            .set("Accept", "application/json")
            //Отправляем НЕКОРРЕКТНОЕ тело запроса
            .send(
                {
                    "email": '123213313sadsdad@sae',
                    "nickname": '1',
                    "password": 'a1'
                })
            //Должны получить BAD REQUEST - 400
            .expect(400)
            //И следющий ответ
            .expect('Validation error.')
    });
    //Второй тест - пост запрос на регистрацию, тело запроса - правильное, но пользователь уже существует
    it('[AUTH] - (2) - /registration (POST) [ПОЛЬЗОВАТЕЛЬ УЖЕ СУЩЕСТВУЕТ]', () => {
        return request(app.getHttpServer())
            //Отправляем запрос
            .post('/auth/registration')
            //Прописываем заголовки
            .set("Accept", "application/json")
            //Отправляем НЕКОРРЕКТНОЕ тело запроса
            .send(
                {
                    "email": '12lol34lol56lol@gmail.com',
                    "nickname": 'Artemis',
                    "password": 'aasedasdQew1'
                })
            //Должны получить BAD REQUEST - 400
            .expect(400)
            //И следющий ответ
            .expect('User already exists.')
    });
    //Третий тест - пост запрос на регистрацию, тело запроса - правильное, пользователя не существует
    it('[AUTH] - (3) - /registration (POST) [ВСЕ ОК]', () => {
        return request(app.getHttpServer())
            //Отправляем запрос с уже токеном нашим
            .post(`/auth/registration?token=${token}`)
            //Прописываем заголовки
            .set("Accept", "application/json")
            //Отправляем НЕКОРРЕКТНОЕ тело запроса
            .send(
                {
                    "email": email,
                    "nickname": 'TEST1',
                    "password": 'TESTPASSWORD1'
                })
            //Должны получить OK - 200
            .expect(200)
            //И следющий ответ
            .expect('Success')
    });
    //Четвертый тест - гет запрос - проверяем код из имейла при нашем токене, продолжаем с нашего предыдщего пользователя
    //Код из почты в данном тесте будет только неправильным
    it('[AUTH] - (4) - /requestToMailer_doneConfirmation (GET) [КОД ИЗ ИМЕЙЛА НЕПРАВИЛЬНЫЙ]', () => {
        return request(app.getHttpServer())
            //Отправляем запрос с уже токеном нашим и неправильным кодом
            .get(`/auth/requestToMailer_doneConfirmation?token=${token}&nickname=TEST1&email=${email}&code=332132`)
            //Должны получить OK - 200
            .expect(400)
            //И следющий ответ - КОД НЕВЕРНЫЙ
            .expect('Invalid Code')
    });
    //Пятый тест -  гет запрос - просим новый код на имейл с кваери, где токен - неверный
    it('[AUTH] - (5) - /requestToMailer_newCode (GET) [ТОКЕН - НЕВЕРНЫЙ]', () => {
        return request(app.getHttpServer())
            //Отправляем запрос с уже токеном нашим и неправильным кодом
            .get(`/auth/requestToMailer_newCode?token=WRONGTOKEN&email=${email}`)
            //Должны получить BAD REQUEST - 400
            .expect(400)
            //И следющий ответ - ТОКЕН НЕВЕРНЫЙ!
            .expect('Invalid Token!')
    });
    //Шестой тест -  гет запрос - просим новый код на имейл с кваери, где токен - ок
    it('[AUTH] - (6) - /requestToMailer_newCode (GET) [ТОКЕН - ОК]', () => {
        return request(app.getHttpServer())
            //Отправляем запрос с уже токеном нашим и неправильным кодом
            .get(`/auth/requestToMailer_newCode?token=${token}&email=${email}`)
            //Должны получить OK - 200
            .expect(200)
            //И следющий ответ - OK
            .expect('OK')
    });
    //Седьмой тест - гет запрос на логин по куки, куки - нет
    it('[AUTH] - (7) - /credentialsLogin (GET) [КУКИ НЕТ]', () => {
        return request(app.getHttpServer())
            //Отправляем запрос с ок кваери
            .get('/auth/credentialsLogin')
            //НЕ Прикрепляем куки с jwt
            //.set('Cookie', `account=${jwt};`)
            // Должны получить OK - 200
            .expect(200)
            //И в ответе должно быть следющее: токен больше нуля символов
            .expect(res => res.body.token.length > 0)
    });
    //Восьмой тест - гет запрос на логин по куки, куки - с неправильной подписью, иначе - взлом
    it('[AUTH] - (8) - /credentialsLogin (GET) [КУКИ C НЕПРАВИЛЬНОЙ ПОДПИСЬЮ]', () => {
        const fakeJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIiLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjJ9.g8EJ5kDLnXy74ooX6S_7RXvZpyl3LWxRL9EH1AXRZh0'
        return request(app.getHttpServer())
            //Отправляем запрос с ок кваери
            .get('/auth/credentialsLogin')
            //НЕ Прикрепляем куки с fake jwt
            .set('Cookie', `account=${fakeJWT}`)
            // Должны получить 406 код ответа
            .expect(406)
    });
    //Девятый тест - гет запрос на логин по куки, куки - ок
    it('[AUTH] - (9) - /credentialsLogin (GET) [КУКИ ЕСТЬ]', () => {
        return request(app.getHttpServer())
            //Отправляем запрос с ок кваери
            .get('/auth/credentialsLogin')
            //НЕ Прикрепляем куки с jwt
            .set('Cookie', `account=${jwt};`)
            // Должны получить OK - 200
            .expect(200)
            //И в ответе должно быть следющее: токен больше нуля символов
            .expect(res => res.body.token.length > 0)
    });
    //Десятый тест - гет запрос на логин, где кваери запроса, а именно почта и пароль - неверные
    it('[AUTH] - (10) - /login (GET) [КВАЕРИ ПЛОХОЕ]', () => {
        return request(app.getHttpServer())
            //Отправляем запрос с ок кваери
            .get(`/auth/login?token=${token}&email=sadasdsada&password=dsa`)
            // Должны получить BAD REQUEST - 400
            .expect(400)
            //И в ответе должно быть следющее: токен больше нуля символов
            .expect('Invalid password or mail')
    });
    //Одинадцатый тест - гет запрос на логин, где кваери запроса, а именно почта и пароль - правильные
    it('[AUTH] - (11) - /login (GET) [КВАЕРИ ПРАВИЛЬНОЕ]', () => {
        return request(app.getHttpServer())
            //Отправляем запрос с ок кваери
            .get(`/auth/login?token=${token}&email=12lol34lol56lol@gmail.com&password=Artem1007`)
            // Должны получить OK - 200
            .expect(200)
            //И в ответе должно быть следющее: токен больше нуля символов
            .expect('Login success')
    });
});

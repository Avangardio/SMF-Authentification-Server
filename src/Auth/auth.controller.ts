import {Body, Controller, Get, Post, Query, Req, Response} from '@nestjs/common';
import {AuthService} from "./auth.service";
import {Request} from "express";
import {randomUUID} from "crypto";
import {JwtService} from "@nestjs/jwt";
import axios from "axios";
import {mailerLink} from "../../EnvUrl";

type registrationBody = {
    email: string
    password: string
    nickname?: string
}
type accountBody = {
    email: string
    nickname: string
}
type answerBody = {
    //Пароль и почта аккаунта
    account?: accountBody
    token?: string
}
type QueryToken = {
    token: string
}


@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService,
                private readonly jwtService: JwtService) {
    }

    @Get('logout')
    //метод класса, отвечающий за логаут
    logout_controller(@Response() response) {
        //чистим куки с jwt
        response.cookie('account', '', {expires: new Date()});

        //чистим nextjs куки
        response.cookie('next-auth.session-token', '', {expires: new Date()});
        response.cookie('next-auth.callback-url', '', {expires: new Date()});
        response.cookie('next-auth.csrf-token', '', {expires: new Date()});
        //отправляем ответ
        response.status(200).send('OK')
    }

    //Post-запрос, отвечающий за регистрацию. Принимает тело из пароля, почты и никнейма пользователя. А так же токен.
    @Post('registration')
    registration_Controller(@Query() query: QueryToken, @Response() res, @Body() regBody: registrationBody, @Req() request: Request): void {
        //Вызываем метод сервиса, который проводит валидацию данных и сохраняет пользователя
        this.authService.registration(query.token, regBody)
            .then(
                //Коллбек успеха. Отправляет запрос в почтовый сервис на добавление и отправку кода верификации аккаунта
                function (result) {
                    axios.get(`${mailerLink}/confirmation?account=${regBody.email}`)
                        //Ловим ошибки todo: добавить в логгер
                        .catch(error => console.log('Mailing Error'))
                    //Отсылаем Успешный ответ клиенту
                    res.status(200).send('Success')
                },
                //В случае не прохождения валидации или добавлнеия пользователя, отправляем клиенту ошибку с текстом ошибки для дальнейшей обработки
                function (error) {
                    res.status(400).send(error.message)
                }
            )
    };

    //Get запрос, ответственный за логин пользователя, прикрепление токена к почте
    @Get('login')
    //Метод контроллера, принимающий кваери: token: токен, email: имейл, password: пароль
    async login_Controller(@Query() query: QueryToken & registrationBody, @Response() response): Promise<void> {
        //проверяем все параметры
        if (!query.email || !query.password || !query.token) return response(400).send('Invalid data');
        //не ждем резолва, отправляем ответ как придет
        this.authService.login_service(query)
            .then(
                //колбек успеха
                result => {
                    //если результат = false, возвращаем что прошло не успешно
                    if (result === false) return response.status(400).send('Invalid password or mail');
                    //Подписываем и отправляем куки с аккаунтом
                    console.log(result.user_email, result.user_nickname)
                    const token = this.jwtService.sign({
                        account: {
                            email: result.user_email,
                            nickname: result.user_nickname
                        }
                    }, {expiresIn: "150d"});
                    //Прикрепляем куки к ответу на 150 дней (150д * 24ч * 60м * 60с* 1000мс)
                    response.cookie('account', token, {
                        expires: new Date(Date.now() + (150 * 24 * 60 * 60 * 1000)),
                        httpOnly: true,
                        path: '/'
                    });
                    //если есть результат, отправляем удачу
                    response.status(200).send('Login success');
                },
                //колбек ошибки
                error => {
                    //отправляем ответ
                    console.log(error)
                    response.status(400).send('Internal error');
                });
    }


    //Get-запрос, отвечающий за аутентификацию через jwt-куки
    @Get('credentialsLogin')
    async credentialsLogin_Controller(@Req() request: Request, @Response() response): Promise<void> {
        //Создаем случайный токен для защиты от ненужных действия пользователя
        const uuid = randomUUID();
        //Создаем кастомный объект для отправки пользователя
        let outputData: answerBody = {
            account: {
                email: '',
                nickname: ''
            }
        };
        //Проверяем есть ли куки с аккаунтом пользователя. Если нет, то отправляем просто токен и заканчиваем метод
        if (request.cookies.account) {
            //Блок, отвечающий за проверку, не взломали ли куки
            try {
                //Расшифровываем токен
                const decoded = this.jwtService.verify(request.cookies.account)
                //Все нормально, добавляем данные в ответ

                outputData.account = decoded.account;
                //Подписываем и пролонгируем токен

                const token = this.jwtService.sign({
                    account: outputData.account
                }, {expiresIn: "150d"});
                //Прикрепляем токен к куки

                response.cookie('account', token, {
                    expires: new Date(Date.now() + (150 * 24 * 60 * 60 * 1000)),
                    httpOnly: true,
                    path: '/'
                });

            }
                //Срабатывает Если токен взламывают, клиент обработает
            catch (error) {
                response.status(406).send('Client Error');
                return;
            }
        }
        //Вызываем метод сервиса регистрации, отвечающий за добавление токена в базу данных
        await this.authService.credentialsLoginService(uuid, outputData.account.email ? outputData.account.email : null)
            //Колбек, добавляющий в ответ токен
            .then(result => outputData.token = uuid,
                //Колбек ошибки, добавляем плейсхолдер токена, клиент сможет понять что что-то не так
                error => outputData.token = 'errorcode'
            );
        //Отправляем аккаунт и токен для клиента
        response.status(200).json(outputData);
    }

    //Get-запрос, ответственный за логин через внешние сервисы, принимает почту и никнейм
    @Get('externalLogin')
    async externalLogin(@Query() query: accountBody, @Response() response): Promise<void> {
        // declare all characters
        const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        //Функция для генерации строки
        function generateString(length) {
            let result = ' ';
            do {
                result = ' ';
                const charactersLength = characters.length;
                for (let i = 0; i < length; i++) {
                    result += characters.charAt(Math.floor(Math.random() * charactersLength));
                }
            } while (new RegExp('\\w*\\d').test(result) !== true);
            return result;
        }
        //Генерируем случайный пароль
        const uuid = generateString(10);
        try {
            //Вызываем метод сервиса, который ответсвенный за проверку пользователя и регистрацию.
            const user = await this.authService.externalLoginService({
                email: query.email,
                nickname: query.nickname
            }, uuid);
            //Если вернулся новый пароль, то пользователь новый, надо отправить пользователю.
            if (user.newPassword) {
                //отправляем запрос на отправку внутреннего пароля на почту пользователю.
                axios.get(`${mailerLink}/sendInternalPassword?email=${user.email}&password=${uuid}`)
                    //ловим ошибки.
                    .catch(error => console.log('Mailing Error'))
                //Создаем таблицу пользователя
                await this.authService.doneConfirmation_service(query.email)
                    .then(
                        result => console.log(result),
                        error => console.log(error)
                    )
            }
            ;
            //Подписываем и отправляем куки с аккаунтом
            const token = this.jwtService.sign({
                account: {
                    email: user.email,
                    nickname: user.nickname
                }
            }, {expiresIn: "150d"});
            //Прикрепляем куки к ответу на 150 дней (150д * 24ч * 60м * 60с* 1000мс)
            response.cookie('account', token, {
                expires: new Date(Date.now() + (150 * 24 * 60 * 60 * 1000)),
                httpOnly: true,
                path: '/'
            });

            //отправляем ответ
            response.status(200).send('Success');
        } catch (error) {
            //Колбек ошибки, отправляем ошщибку клиенту для обработки
            console.log(error)
            response.status(400).send(error.message);
        }
    }

    //Get-запрос на получение нового кода подтверждения, обязательно проверить токеном
    @Get('requestToMailer_newCode')
    //Метод контроллера для вызова проверки контроллера и дальнейшим запросом на мейлер
    async requestToMailer_newCode_Controller(@Query() query: QueryToken & { email: string }, @Response() response): Promise<void> {
        //Вызываем валидацию по токену
        this.authService.validateToken(query.token)
            .then(
                //Если все хорошо, отправляем запрос с полученным имейлом
                email => {
                    //проверяем, совпадает ли почта с почтой токена
                    if (email === query.email) {
                        //Отправляем запрос на письмо
                        axios.get(`${mailerLink}/confirmation?account=${email}`)
                            //ловим ошибки
                            .catch(error => console.log('Mailing Error'))
                        //отправляем ответ ок
                        response.status(200).send('OK');
                        //Иначе
                    } else {
                        //Отправляем бедреквест
                        response.status(400).send('Validation error');
                    }
                },
                //если валидация выкинула ошибку, отправляем бед реквест
                error => response.status(400).send(error.message)
            )
    }

    //Get-запрос с кваери: токен, имейл, никнейм
    @Get('requestToMailer_doneConfirmation')
    //Метод контроллера для вызова проверки токена и запросом на мейлер для проверки кода подтверждения
    async requestToMailer_doneConfirmation_Controller(@Query() query: QueryToken & accountBody & { code: string }, @Response() response) {
        try {
            //получаем имейл из токена и валидизуем его
            const tokenEmail = await this.authService.validateToken(query.token);
            //Проверяем, совпадают ли почты
            if (query.email !== tokenEmail) throw new Error('Validation Error');
            //Отправляем запрос на сверку код
            const answer = await axios.get(`${mailerLink}/doneConfirmation?token=${query.token}&email=${tokenEmail}&nickname=${query.nickname}&code=${query.code}`)
                //Ловим ошибку
                .catch(error => {
                    //Пробрасываем ее для типизации ошибок
                    throw new Error(error.response.data);
                })
            //Если все нормально подписываем куки с аккаунтом
            const token = this.jwtService.sign({
                account: {email: answer.data.email, nickname: answer.data.nickname}
            }, {expiresIn: "150d"});
            //Прикрепляем токен к куки
            response.cookie('account', token, {
                expires: new Date(Date.now() + (150 * 24 * 60 * 60 * 1000)),
                httpOnly: true,
                path: '/'
            });
            //Отправляем ответ успешный.
            response.status(200).send('Success')
            //Создаем таблицу пользователя
            await this.authService.doneConfirmation_service(answer.data.email)
                .catch(
                    error => console.log(error)
                )
            //Ловим ошибки
        } catch (error) {
            //Отправляем Человеский текст ошибок для клиента
            response.status(400).send(error.message)
        }
    }

    //GET запрос для восстановления пароля, принимает кваери
    @Get('requestToMailer_Recovery')
    async requestToMailer_recovery(@Query() query: { email: string, password: string, rePassword: string, code: string }, @Response() response) {
        //если есть имейл, но нет кода, отпарвляем запрос на проверку пользователя
        try {
            if (query.email && !query.code) {
                //проверка пользователя, ждем резолва
                await this.authService.requestToMailer_recoveryService({email: query.email}).catch(error => console.log(error));
                //отправляем запрос на отправку кода
                axios.get(`${mailerLink}/passwordRecovery?email=${query.email}`)
                    .then(//\
                        //Колбек успеха //отправляем что код отправлен на имейл
                        result => response.status(200).send(result.data)
                    );
            }
            if (query.email && query.code && !query.password) {
                await axios.get(`${mailerLink}/passwordRecovery?email=${query.email}&code=${query.code}`)
                    .then(//\
                        //Колбек успеха //отправляем что код отправлен на имейл
                        result => response.status(200).send(result.data),
                        error => {
                            throw new Error(error.response.data)
                        }
                    );

            }
            //если есть все необходимое, проходим
            if (query.email && query.code && query.password && query.rePassword) {
                //проверяем валидность кода
                await axios.get(`${mailerLink}/passwordRecovery?email=${query.email}&code=${query.code}`);
                //Если ошибки нет, то сверяем пароли, если не совпадают, выбрасываем ошибку
                if (query.password !== query.rePassword) {
                    throw new Error('Passwords are not equal')
                }
                ;
                //Обновляем пароль, резолва не ждем
                this.authService.requestToMailer_recoveryService({email: query.email, password: query.password})
                    .then(
                        //если все хорошо, отправляем что пароль изменен
                        result => response.status(200).send('Password changed'),
                        //если ошибка, то отправляем ошибку
                        error => response.status(400).send('Error')
                    )
            }
            //ловим ошибки и отправляем клиенту
        } catch (error) {
            response.status(400).send(error.message)
        }
    }
}
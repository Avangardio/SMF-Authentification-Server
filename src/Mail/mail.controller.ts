import {Controller, Get, Headers, Query, Req, Response} from '@nestjs/common';
import {MailService} from './mail.service';
import {JwtService} from "@nestjs/jwt";
import {query, Request} from "express";

class GetMailDTO {
    account: string;
}

type codeConfDto = {
    email: string
    nickname: string
    code: string
}

type MailQuery = {
    email: string
    password: string
}


@Controller('mail')
//Класс контроллера
export class MailController {

    constructor(
        //Инициальзируем мейл сервис
        private mailService: MailService
    ) {}

    //Get запрос с кваери, принимающая имейл, возвращает строку и отправляет письмо на почту с кодом
    @Get('confirmation')
    receiveMail(@Headers() headers: Headers, @Query() getMailDto: GetMailDTO, @Response() response): string {
        //Проверяем квареи на наличие почты
        if(!getMailDto.account) return response.status(400);
        //Вызываем метод сервиса, который отправляет код для подтверждения. Коллбеки ИГНОРИРУЕМ, ошибки ловятся внутри.
        this.mailService.initConfirmation(getMailDto.account);
        //Отправляем строку
        return response.status(200).send('Need Confirmation');
    }

    //Get запрос с кваери: почта, пароль и код подтверждения, возвращает либо успех либо ошибку, которую обработает другой контроллер
    @Get('doneConfirmation')
    doneMail(@Query() query: codeConfDto, @Response() response, @Req() request: Request): void {
        //Вызывает метод сервиса, которые меняет статус подтверждения в базе данных
        this.mailService.doneConfirmation(query)
            .then(
                //если все прошло успешно, отправляем обратно кваери
                result => response.status(200).json(query),
                //Коллбек вызывается когда введеный код неверен
                error => response.status(400).send('Invalid Code')
            )
    };

    //Get запрос для отправки внутреннего пароля пользователю, регистрируещгося через внешние сервисы
    @Get('sendInternalPassword')
    sendInternalPasswordController(@Query() query: MailQuery, @Response() response) {
        //Вызываем метод сервиса, ошибки ловятся внутри, колбеки игнорируем.
        this.mailService.sendInternalPasswordService(query);
        response.status(200);
    }

    //Get запрос для добавления и отправки и проверки кода для восстановления пароля
    @Get('passwordRecovery')
    async passwordRecoveryController(@Query() query: { email: string, code: string }, @Response() response) {
        this.mailService.passwordRecoveryService(query)
            .then(
                result => {
                    console.log(result)
                    if (!query.code) return response.status(200).send('Email has been sent');
                    return response.status(200).send('Success');
                },
                error => {
                    if (query.code) return response.status(400).send('Wrong code');
                }
            )
    }
}

import {CanActivate, ExecutionContext, Injectable} from '@nestjs/common';
import {InjectRedis} from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(@InjectRedis() private readonly redis: Redis) {
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const params = request.params;
        const token = params.token;

        return await this.redis.get(`${token}`) !== null;
    }
}
import {Column, Entity, PrimaryGeneratedColumn} from 'typeorm';

@Entity({name: 'users'})
export class Users {
    @PrimaryGeneratedColumn()
    user_id: number;

    @Column()
    user_nickname: string;

    @Column()
    user_email: string;

    @Column()
    user_password: string;

    @Column()
    user_confirmed: boolean;
}
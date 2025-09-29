import { IsNotEmpty, IsUUID } from "class-validator";

export class RegisterUserRoleDTO {
    @IsNotEmpty()
    @IsUUID()
    userId: number;

    @IsNotEmpty()
    @IsUUID()
    roleId: number;
}
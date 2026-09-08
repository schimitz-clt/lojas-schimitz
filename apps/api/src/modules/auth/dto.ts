import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'cliente@exemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, description: 'Letras e números' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'Senha deve ter letras e números' })
  password!: string;

  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: '51999990000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'cliente@exemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token opaco' })
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'cliente@exemplo.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recebido por e-mail (hex)' })
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'Senha deve ter letras e números' })
  password!: string;
}

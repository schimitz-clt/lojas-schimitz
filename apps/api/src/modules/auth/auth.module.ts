import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginAttemptService } from './login-attempt.service';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [JwtModule.register({}), CartModule],
  controllers: [AuthController],
  providers: [AuthService, LoginAttemptService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

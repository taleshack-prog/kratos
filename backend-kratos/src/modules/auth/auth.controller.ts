import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
@ApiTags('auth') @Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Post('register') @ApiOperation({summary:'Cadastrar atleta'})
  register(@Body() dto: any) { return this.service.register(dto); }
  @Post('login') @HttpCode(HttpStatus.OK) @ApiOperation({summary:'Login com biometria'})
  login(@Body() dto: any) { return this.service.login(dto); }
}
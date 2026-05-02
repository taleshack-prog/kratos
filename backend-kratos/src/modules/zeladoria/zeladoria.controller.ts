import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZeladoriaService } from './zeladoria.service';
@ApiTags('zeladoria') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('zeladoria')
export class ZeladoriaController {
  constructor(private readonly service: ZeladoriaService) {}
  @Post() @ApiOperation({summary:'Criar report de problema'})
  create(@Body() dto: any, @Request() req: any) { return this.service.createReport(dto,req.user.id); }
  @Get('mine') @ApiOperation({summary:'Meus reports'})
  findMine(@Request() req: any) { return this.service.findByAthlete(req.user.id); }
}
import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParentsService } from './parents.service';
@ApiTags('parents') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('parents')
export class ParentsController {
  constructor(private readonly service: ParentsService) {}
  @Get('authorizations/pending') @ApiOperation({summary:'Autorizacoes pendentes'})
  getPending(@Request() req: any) { return this.service.getPending(req.user.id); }
  @Post('authorizations/:id/respond') @ApiOperation({summary:'Aprovar ou negar partida'})
  respond(@Param('id') id: string, @Body() dto: any, @Request() req: any) { return this.service.respond(id,req.user.id,dto.status); }
}
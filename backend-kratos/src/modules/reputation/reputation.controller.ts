import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EloService } from './elo.service';
@ApiTags('reputation') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('reputation')
export class ReputationController {
  constructor(private readonly service: EloService) {}
  @Post('elo/update') @ApiOperation({summary:'Atualiza Elo H+C+Z apos partida'})
  update(@Body() dto: any, @Request() req: any) { return this.service.updateAfterMatch({...dto,athleteId:req.user.id}); }
}
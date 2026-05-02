import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MatchSchedulingService } from './match-scheduling.service';
@ApiTags('matches') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('matches')
export class MatchesController {
  constructor(private readonly service: MatchSchedulingService) {}
  @Post() @ApiOperation({summary:'Agendar partida'})
  create(@Body() dto: any, @Request() req: any) { return this.service.createMatch({...dto, creatorId:req.user.id}); }
  @Post(':id/join') @ApiOperation({summary:'Entrar na partida'})
  join(@Param('id') id: string, @Body() dto: any, @Request() req: any) { return this.service.joinMatch(id,req.user.id,dto.teamColor); }
  @Get('upcoming') @ApiOperation({summary:'Proximas partidas'})
  upcoming(@Query('courtId') courtId?: string, @Query('limit') limit=20) { return this.service.findUpcoming(courtId,+limit); }
  @Get(':id') @ApiOperation({summary:'Detalhes da partida'})
  findOne(@Param('id') id: string) { return this.service.findMatchDetails(id); }
  @Post(':id/cancel') @ApiOperation({summary:'Cancelar partida'})
  cancel(@Param('id') id: string, @Request() req: any) { return this.service.cancelMatch(id,req.user.id); }
}
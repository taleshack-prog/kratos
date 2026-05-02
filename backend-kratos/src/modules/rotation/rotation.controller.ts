import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RotationService } from './rotation.service';
import { TeamFormationService } from './team-formation.service';
@ApiTags('rotation') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('rotation')
export class RotationController {
  constructor(private readonly r: RotationService, private readonly f: TeamFormationService) {}
  @Post(':matchId/initialize') @ApiOperation({summary:'Inicializa rotacao'})
  init(@Param('matchId') id: string) { return this.r.initializeRotation(id); }
  @Get(':matchId/config') @ApiOperation({summary:'Config de rotacao'})
  config(@Param('matchId') id: string) { return this.r.getConfig(id); }
  @Post(':matchId/game-end') @ApiOperation({summary:'Fim de rodada'})
  end(@Param('matchId') id: string, @Body() dto: any, @Request() req: any) { return this.r.processGameEnd({matchId:id,...dto,initiatedBy:req.user.id}); }
  @Get(':matchId/formation') @ApiOperation({summary:'Estado da formacao'})
  formation(@Param('matchId') id: string) { return this.f.getFormationState(id); }
  @Post(':matchId/draft/pick') @ApiOperation({summary:'Pick no draft'})
  pick(@Param('matchId') id: string, @Body() dto: any, @Request() req: any) { return this.f.makeDraftPick({matchId:id,captainId:req.user.id,...dto}); }
  @Post(':matchId/consensus/join') @ApiOperation({summary:'Entrar num time por consenso'})
  join(@Param('matchId') id: string, @Body() dto: any, @Request() req: any) { return this.f.consensusJoinTeam({matchId:id,athleteId:req.user.id,...dto}); }
}
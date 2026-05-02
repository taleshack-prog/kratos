import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AthletesService } from './athletes.service';
@ApiTags('athletes') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('athletes')
export class AthletesController {
  constructor(private readonly service: AthletesService) {}
  @Get('me') @ApiOperation({summary:'Perfil do atleta autenticado'}) getMe(@Request() req: any) { return this.service.findProfile(req.user.id); }
  @Get('ranking') @ApiOperation({summary:'Ranking top 20'}) getRanking() { return this.service.getRanking(); }
  @Get('me/dependents') @ApiOperation({summary:'Lista dependentes'}) getDependents(@Request() req: any) { return this.service.getDependents(req.user.id); }
  @Get(':id') @ApiOperation({summary:'Perfil publico'}) findOne(@Param('id') id: string) { return this.service.findProfile(id); }
}
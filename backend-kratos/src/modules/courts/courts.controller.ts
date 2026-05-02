import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CourtsService } from './courts.service';
@ApiTags('courts') @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard) @Controller('courts')
export class CourtsController {
  constructor(private readonly service: CourtsService) {}
  @Get('nearby') @ApiOperation({summary:'Quadras proximas por GPS'})
  findNearby(@Query('lat') lat: number, @Query('lng') lng: number, @Query('radiusKm') r?: number) { return this.service.findNearby(+lat,+lng,r?+r:5); }
  @Get(':id') @ApiOperation({summary:'Detalhes da quadra'}) findOne(@Param('id') id: string) { return this.service.findById(id); }
  @Get(':id/availability') @ApiOperation({summary:'Slots de disponibilidade'}) getAvailability(@Param('id') id: string) { return this.service.getAvailability(id); }
}
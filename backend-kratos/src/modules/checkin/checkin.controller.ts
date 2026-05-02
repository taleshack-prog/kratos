import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckinP2PService } from './checkin-p2p.service';

export class CheckinP2PDto {
  @ApiProperty() @IsUUID() matchId: string;
  @ApiProperty() @IsUUID() validatorId: string;
  @ApiProperty() @IsNumber() @Min(-120) @Max(0) @Type(() => Number) bluetoothRssi: number;
  @ApiProperty() @IsNumber() @Type(() => Number) latitude: number;
  @ApiProperty() @IsNumber() @Type(() => Number) longitude: number;
  @ApiProperty() @IsString() ephemeralToken: string;
}

@ApiTags('checkin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('checkin')
export class CheckinController {
  constructor(private readonly service: CheckinP2PService) {}
  @Post('p2p')
  @ApiOperation({ summary: 'Check-in P2P via Bluetooth LE + GPS' })
  @ApiBody({ type: CheckinP2PDto })
  checkIn(@Body() dto: CheckinP2PDto, @Request() req: any) {
    return this.service.processCheckin({ ...dto, athleteId: req.user.id });
  }
}
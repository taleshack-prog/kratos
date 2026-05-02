import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller';
import { CheckinP2PService } from './checkin-p2p.service';

@Module({
  controllers: [CheckinController],
  providers:   [CheckinP2PService],
  exports:     [CheckinP2PService],
})
export class CheckinModule {}

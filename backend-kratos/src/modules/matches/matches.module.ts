import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesController } from './matches.controller';
import { MatchSchedulingService } from './match-scheduling.service';
import { MatchScheduling } from '../../entities/court.entity';
import { Athlete } from '../../entities/athlete.entity';
@Module({ imports:[TypeOrmModule.forFeature([MatchScheduling,Athlete])], controllers:[MatchesController], providers:[MatchSchedulingService], exports:[MatchSchedulingService] })
export class MatchesModule {}
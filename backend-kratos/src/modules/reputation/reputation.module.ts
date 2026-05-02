import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReputationController } from './reputation.controller';
import { EloService } from './elo.service';
import { Athlete } from '../../entities/athlete.entity';
@Module({ imports:[TypeOrmModule.forFeature([Athlete])], controllers:[ReputationController], providers:[EloService], exports:[EloService] })
export class ReputationModule {}
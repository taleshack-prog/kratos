import { Module } from '@nestjs/common';
import { RotationController } from './rotation.controller';
import { RotationService } from './rotation.service';
import { TeamFormationService } from './team-formation.service';
@Module({ controllers:[RotationController], providers:[RotationService,TeamFormationService] })
export class RotationModule {}
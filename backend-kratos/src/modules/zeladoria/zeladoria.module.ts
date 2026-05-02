import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZeladoriaController } from './zeladoria.controller';
import { ZeladoriaService } from './zeladoria.service';
@Module({ imports:[HttpModule], controllers:[ZeladoriaController], providers:[ZeladoriaService] })
export class ZeladoriaModule {}
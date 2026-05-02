import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class ZeladoriaService {
  constructor(private readonly dataSource: DataSource) {}
  async createReport(dto: any, athleteId: string) {
    const r = await this.dataSource.query(
      'INSERT INTO zeladoria_reports (court_id,reporter_id,issue_type,description,gps_point,photos) VALUES (,,,,ST_SetSRID(ST_MakePoint(,),4326),::jsonb) RETURNING id',
      [dto.courtId,athleteId,dto.issueType,dto.description||null,dto.longitude||null,dto.latitude||null,JSON.stringify(dto.photos||[])]);
    return { id:r[0].id, message:'Report criado. +5 Elo Z pendente de validacao.' };
  }
  async findByAthlete(athleteId: string) {
    return this.dataSource.query('SELECT zr.*,c.name AS court_name FROM zeladoria_reports zr JOIN courts c ON c.id=zr.court_id WHERE zr.reporter_id= ORDER BY zr.created_at DESC',[athleteId]);
  }
}
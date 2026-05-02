import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
@Injectable()
export class CourtsService {
  constructor(private readonly dataSource: DataSource) {}
  async findNearby(lat: number, lng: number, radiusKm=5) {
    return this.dataSource.query(
      "SELECT c.id, c.name, c.address, c.status, ROUND(ST_Distance(ST_Centroid(c.geom)::geography, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography)/1000,2) AS distance_km FROM courts c WHERE c.status='active' AND ST_DWithin(ST_Centroid(c.geom)::geography, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography, $3*1000) ORDER BY distance_km ASC",
      [lat,lng,radiusKm]);
  }
  async findById(id: string) {
    const r = await this.dataSource.query("SELECT c.*, ST_AsGeoJSON(c.geom)::json AS geojson FROM courts c WHERE c.id=$1",[id]);
    return r[0] ?? null;
  }
  async getAvailability(courtId: string) {
    return this.dataSource.query("SELECT * FROM courts_availability WHERE court_id=$1 ORDER BY weekday,slot_start",[courtId]);
  }
}
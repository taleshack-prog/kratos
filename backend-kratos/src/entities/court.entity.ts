import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('courts')
export class Court {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name:'pmpa_asset_id', length:50, unique:true, nullable:true }) pmpaAssetId: string;
  @Column({ length:100 }) name: string;
  @Column({ nullable:true, type:'text' }) address: string;
  @Column({ type:'geometry', spatialFeatureType:'Polygon', srid:4326 }) geom: string;
  @Column({ default:'active' }) status: string;
  @Column({ name:'half_court_simultaneous', default:false }) halfCourtSimultaneous: boolean;
  @Column({ name:'opening_hour', type:'time', nullable:true }) openingHour: string;
  @Column({ name:'closing_hour', type:'time', nullable:true }) closingHour: string;
  @CreateDateColumn({ name:'created_at' }) createdAt: Date;
}

export enum MatchStatus {
  SCHEDULED           = 'scheduled',
  CHECKIN             = 'checkin',
  ONGOING             = 'ongoing',
  FINISHED            = 'finished',
  CANCELLED           = 'cancelled',
  QUORUM_INSUFFICIENT = 'quorum_insufficient',
}

@Entity('match_scheduling')
export class MatchScheduling {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name:'court_id', type:'uuid', nullable:true }) courtId: string;
  @Column({ name:'creator_id', type:'uuid' }) creatorId: string;
  @Column({ type:'smallint' }) modality: number;
  @Column({ name:'match_type', default:'public' }) matchType: string;
  @Column({ name:'court_half', nullable:true }) courtHalf: string;
  @Column({ name:'min_elo', default:0 }) minElo: number;
  @Column({ name:'min_quorum', type:'smallint' }) minQuorum: number;
  @Column({ name:'scheduled_start', type:'timestamp' }) scheduledStart: Date;
  @Column({ name:'scheduled_end', type:'timestamp' }) scheduledEnd: Date;
  @Column({ default:'scheduled' }) status: string;
  @CreateDateColumn({ name:'created_at' }) createdAt: Date;
}

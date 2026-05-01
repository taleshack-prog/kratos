// src/entities/court.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany,
} from 'typeorm';

@Entity('courts')
export class Court {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pmpa_asset_id', length: 50, unique: true, nullable: true })
  pmpaAssetId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ nullable: true, type: 'text' })
  address: string;

  /** POLYGON WGS-84 do perímetro físico da quadra. Tipo gerido pelo PostGIS. */
  @Column({ type: 'geometry', spatialFeatureType: 'Polygon', srid: 4326 })
  geom: string;

  @Column({
    default: 'active',
    enum: ['active', 'maintenance', 'closed'],
  })
  status: string;

  @Column({ name: 'half_court_simultaneous', default: false })
  halfCourtSimultaneous: boolean;

  @Column({ name: 'opening_hour', type: 'time', nullable: true })
  openingHour: string;

  @Column({ name: 'closing_hour', type: 'time', nullable: true })
  closingHour: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────

// src/entities/match-scheduling.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  CreateDateColumn, JoinColumn, OneToMany,
} from 'typeorm';

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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Court, { nullable: true })
  @JoinColumn({ name: 'court_id' })
  court: Court;

  @Column({ name: 'court_id', type: 'uuid', nullable: true })
  courtId: string;

  @ManyToOne(() => Athlete)
  @JoinColumn({ name: 'creator_id' })
  creator: Athlete;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  /** 1=1v1, 2=2v2, 3=3v3, 5=5v5 */
  @Column({ type: 'smallint' })
  modality: number;

  @Column({
    name: 'match_type',
    default: 'public',
    enum: ['public', 'private', 'practice'],
  })
  matchType: string;

  @Column({
    name: 'court_half',
    nullable: true,
    enum: ['full', 'home', 'away'],
  })
  courtHalf: string;

  @Column({ name: 'min_elo', default: 0 })
  minElo: number;

  /** Número mínimo de check-ins P2P para mudar status para 'ongoing'. */
  @Column({ name: 'min_quorum', type: 'smallint' })
  minQuorum: number;

  @Column({ name: 'scheduled_start', type: 'timestamp' })
  scheduledStart: Date;

  @Column({ name: 'scheduled_end', type: 'timestamp' })
  scheduledEnd: Date;

  @Column({ default: MatchStatus.SCHEDULED, enum: Object.values(MatchStatus) })
  status: MatchStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// src/entities/athlete.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Check,
} from 'typeorm';

@Entity('athletes')
@Check(`"is_minor" = FALSE OR "parent_id" IS NOT NULL`)
export class Athlete {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ type: 'date', name: 'birth_date' })
  birthDate: Date;

  /** SHA-256 da biometria. Dado bruto NUNCA persiste (LGPD Art. 11). */
  @Column({ name: 'biometric_hash' })
  biometricHash: string;

  @Column({
    nullable: true,
    enum: ['PG', 'SG', 'SF', 'PF', 'C'],
  })
  position: string;

  @Column({ name: 'is_minor', default: false })
  isMinor: boolean;

  /** Responsável: auto-relacionamento quando isMinor = true */
  @ManyToOne(() => Athlete, (a) => a.dependents, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Athlete;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string;

  @OneToMany(() => Athlete, (a) => a.parent)
  dependents: Athlete[];

  /** Elo de Habilidade técnica. Base 1500. */
  @Column({ name: 'elo_h', default: 1500 })
  eloH: number;

  /** Elo de Comportamento / Fair-play. Base 1500. */
  @Column({ name: 'elo_c', default: 1500 })
  eloC: number;

  /** Elo de Zeladoria (bônus por reports válidos). Base 1500. */
  @Column({ name: 'elo_z', default: 1500 })
  eloZ: number;

  @Column({
    name: 'reputation_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  reputationScore: number;

  @Column({ name: 'is_captain', default: false })
  isCaptain: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /** Elo composto: H×0.5 + C×0.3 + Z×0.2 */
  get eloComposite(): number {
    return Math.round(this.eloH * 0.5 + this.eloC * 0.3 + this.eloZ * 0.2);
  }
}

// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule }       from './modules/auth/auth.module';
import { AthletesModule }   from './modules/athletes/athletes.module';
import { CourtsModule }     from './modules/courts/courts.module';
import { MatchesModule }    from './modules/matches/matches.module';
import { CheckinModule }    from './modules/checkin/checkin.module';
import { ReputationModule } from './modules/reputation/reputation.module';
import { ZeladoriaModule }  from './modules/zeladoria/zeladoria.module';
import { ParentsModule }    from './modules/parents/parents.module';
import { RotationModule }   from './modules/rotation/rotation.module';

@Module({
  imports: [
    // ── Configuração de ambiente ───────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ── TypeORM — PostgreSQL + PostGIS ─────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (config: ConfigService) => ({
        type:        'postgres',
        url:         config.get<string>('DATABASE_URL'),
        entities:    [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,  // NUNCA true em produção — usar migrations
        logging:     config.get('NODE_ENV') === 'development',
        ssl: config.get('NODE_ENV') === 'production'
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),

    // ── Módulos de negócio ─────────────────────────────────
    AuthModule,
    AthletesModule,
    CourtsModule,
    MatchesModule,
    CheckinModule,
    ReputationModule,
    ZeladoriaModule,
    ParentsModule,
    RotationModule,
  ],
})
export class AppModule {}

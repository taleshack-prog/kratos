// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── CORS ──────────────────────────────────────────────────
  app.enableCors({
    origin:      ['http://localhost:3000', 'http://localhost:8081'],
    credentials: true,
  });

  // ── Validação global de DTOs ──────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:        true,   // remove campos não declarados no DTO
      forbidNonWhitelisted: true,
      transform:        true,   // converte tipos automaticamente
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Prefixo global da API ─────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Swagger ───────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Kratos Basquete Urbano')
    .setDescription('API do sistema de gestão de basquete de rua em Porto Alegre')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'JWT', in: 'header' },
      'JWT-auth',
    )
    .addTag('auth',      'Autenticação e registro')
    .addTag('athletes',  'Perfis de atletas')
    .addTag('courts',    'Quadras públicas')
    .addTag('matches',   'Agendamento de partidas')
    .addTag('checkin',   'Check-in P2P via Bluetooth')
    .addTag('rotation',  'Sistema de revezamento')
    .addTag('reputation','Elo H+C+Z e reputação')
    .addTag('zeladoria', 'Reports de problemas nas quadras')
    .addTag('parents',   'Módulo de pais e responsáveis')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🏀 Kratos Backend rodando em: http://localhost:${port}`);
  console.log(`📚 Swagger docs em:           http://localhost:${port}/docs`);
}

bootstrap();

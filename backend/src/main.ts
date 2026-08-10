import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers: CSP, HSTS, X-Frame-Options, etc.
  app.use(helmet({
    crossOriginEmbedderPolicy: false, // allow Cloudflare tunnel headers
    contentSecurityPolicy: false,     // API-only; no HTML served
  }));

  // Reads the httpOnly access_token cookie the browser sends automatically
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl ? [frontendUrl] : false,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Tinta Smart API')
    .setDescription('Smart Home Server Management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);

  // Graceful shutdown — close DB connections and flush pending messages
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received — shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}
bootstrap();

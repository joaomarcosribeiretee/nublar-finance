import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.enableCors({
    origin: process.env.DESKTOP_ORIGIN ?? 'http://localhost:5173',
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

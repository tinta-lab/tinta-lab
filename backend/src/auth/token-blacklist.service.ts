import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class TokenBlacklistService implements OnModuleInit {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private redis: Redis;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
    });
    this.redis.on('error', (err) =>
      this.logger.warn(`Redis error: ${err.message}`),
    );
  }

  async add(userId: string, iat: number, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.setex(`bl:${userId}:${iat}`, ttl, '1');
    }
  }

  async isBlacklisted(userId: string, iat: number): Promise<boolean> {
    try {
      return (await this.redis.exists(`bl:${userId}:${iat}`)) > 0;
    } catch {
      return false; // Redis down → don't block requests
    }
  }
}

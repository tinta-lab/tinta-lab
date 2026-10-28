import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationDispatcher } from './notification-dispatcher';
import { TelegramSender } from './telegram-sender';
import { NotificationOutbox } from './entities/notification-outbox.entity';
import { NotificationAttempt } from './entities/notification-attempt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationOutbox, NotificationAttempt]),
  ],
  providers: [NotificationsService, NotificationDispatcher, TelegramSender],
  exports: [NotificationsService],
})
export class NotificationsModule {}

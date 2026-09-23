import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SPREAD_CREATED_QUEUE } from '@cosmic-arcana/sdk';
import { OutboxRelay } from './outbox-relay.service';

@Module({
  imports: [BullModule.registerQueue({ name: SPREAD_CREATED_QUEUE })],
  providers: [OutboxRelay],
})
export class OutboxModule {}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';

import type { Spread } from '../domain/spread';

export type LiveSpreadDrawnV1 = {
  type: 'spread.drawn';
  spreadId: string;
  cards: Array<{ positionKey: string; cardId: string; reversed: boolean }>;
  createdAt: string;
};

export const liveSpreadDrawnPayload = (spread: Spread): LiveSpreadDrawnV1 => ({
  type: 'spread.drawn',
  spreadId: spread.id,
  cards: spread.cards.map((card) => ({
    positionKey: card.positionKey,
    cardId: card.cardId,
    reversed: card.reversed,
  })),
  createdAt: spread.createdAt.toISOString(),
});

@Injectable()
export class LiveSpreadsHub implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveSpreadsHub.name);
  private wss: WebSocketServer | null = null;

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  onModuleInit(): void {
    const server = this.httpAdapterHost.httpAdapter.getHttpServer();
    this.wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const path = request.url?.split('?')[0] ?? '';
      if (path !== '/live') {
        return;
      }
      this.wss?.handleUpgrade(request, socket, head, (ws) => {
        this.wss?.emit('connection', ws, request);
      });
    });
    this.logger.log('live websocket attached', { context: 'LiveSpreadsHub' });
  }

  onModuleDestroy(): void {
    this.wss?.close();
    this.wss = null;
  }

  broadcastDrawn(spread: Spread): void {
    if (!this.wss) {
      return;
    }
    const payload = JSON.stringify(liveSpreadDrawnPayload(spread));
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}

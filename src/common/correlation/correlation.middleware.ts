import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_ID_HEADER, isValidCorrelationId } from './correlation.constants';
import { runWithCorrelationId } from './correlation.storage';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_ID_HEADER);
    const correlationId = isValidCorrelationId(incoming) ? incoming : randomUUID();

    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    runWithCorrelationId(correlationId, () => next());
  }
}

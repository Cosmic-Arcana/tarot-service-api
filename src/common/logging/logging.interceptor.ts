import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { elapsedMs } from './elapsed-ms';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startedAt = process.hrtime.bigint();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    // express types `route` as any; only its path is of interest here.
    const route = (request.route as { path?: string } | undefined)?.path ?? request.path;
    const base = { method: request.method, route };

    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log('inbound handled', {
            ...base,
            statusCode: response.statusCode,
            durationMs: elapsedMs(startedAt),
            outcome: 'success',
          }),
        error: (error: Error) => {
          // The exception filter sets the status after this runs, so derive it from the error.
          const statusCode =
            error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
          const fields = {
            ...base,
            statusCode,
            durationMs: elapsedMs(startedAt),
            outcome: 'error',
            errorName: error.name,
            errorMessage: error.message,
          };
          if (statusCode === Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
            this.logger.error('inbound failed', fields, error.stack);
          } else if (statusCode >= 500) {
            // A dependency outage (502, 503, 504) is expected to happen: the call that failed was
            // already logged where it was made, so repeating it here with a stack adds only noise.
            this.logger.warn('inbound failed', fields);
          } else {
            this.logger.warn('inbound rejected', fields);
          }
        },
      }),
    );
  }
}

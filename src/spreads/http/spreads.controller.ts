import {
  BadRequestException,
  Body,
  BadGatewayException,
  ConflictException,
  Controller,
  GatewayTimeoutException,
  Get,
  Headers,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Response } from 'express';
import type { SpreadDetailsV1 } from '@cosmic-arcana/sdk';
import { CreateSpreadCommand } from '../application/commands/create-spread.command';
import { GetSpreadQuery } from '../application/queries/get-spread.query';
import { IdempotencyKeyConflictError } from '../domain/idempotency-key-conflict.error';
import { SpreadGeneratorUnavailableError } from '../domain/spread-generator-unavailable.error';
import { CreateSpreadDto } from './create-spread.dto';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
  isValidIdempotencyKey,
} from './idempotency-key';
import { toSpreadDetailsV1 } from './spread-details.mapper';
import { InternalTokenGuard } from './internal-token.guard';

/** 503 when it could not be reached, 504 when it took too long, 502 when it answered badly. */
const generatorOutage = ({ reason, message }: SpreadGeneratorUnavailableError): Error => {
  if (reason === 'unreachable') {
    return new ServiceUnavailableException(message);
  }
  return reason === 'timeout'
    ? new GatewayTimeoutException(message)
    : new BadGatewayException(message);
};

@UseGuards(InternalTokenGuard)
@Controller('spreads')
export class SpreadsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async create(
    @Body() body: CreateSpreadDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SpreadDetailsV1> {
    if (!isValidIdempotencyKey(idempotencyKey)) {
      throw new BadRequestException(
        `${IDEMPOTENCY_KEY_HEADER} header must be 8-128 characters of [A-Za-z0-9_-]`,
      );
    }

    try {
      const { spread, replayed } = await this.commandBus.execute(
        new CreateSpreadCommand(body.userId, body.question, idempotencyKey),
      );
      response.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
      response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, String(replayed));
      return toSpreadDetailsV1(spread);
    } catch (error) {
      if (error instanceof IdempotencyKeyConflictError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof SpreadGeneratorUnavailableError) {
        throw generatorOutage(error);
      }
      throw error;
    }
  }

  // TODO(auth): internal re-query endpoint for projections; restrict to service callers.
  @Get(':spreadId')
  async findOne(
    @Param('spreadId', new ParseUUIDPipe()) spreadId: string,
  ): Promise<SpreadDetailsV1> {
    const spread = await this.queryBus.execute(new GetSpreadQuery(spreadId));
    if (!spread) {
      throw new NotFoundException('spread not found');
    }
    return toSpreadDetailsV1(spread);
  }
}

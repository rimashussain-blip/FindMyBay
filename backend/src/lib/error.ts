// Lightweight error handling — every endpoint can throw HttpError(status, message).
// The middleware below converts it to a structured JSON response.

import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, opts: { code?: string; details?: unknown } = {}) {
    super(message);
    this.status = status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

export const notFound = (_req: Request, res: Response) =>
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'validation_failed',
        message: 'Request validation failed',
        details: err.flatten(),
      },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code ?? 'error', message: err.message, details: err.details },
    });
  }
  // body-parser throws SyntaxError with statusCode=400 for invalid JSON.
  if (err instanceof SyntaxError && (err as { statusCode?: number }).statusCode === 400) {
    return res.status(400).json({
      error: { code: 'invalid_json', message: 'Request body is not valid JSON' },
    });
  }
  logger.error({ err }, 'unhandled error');
  return res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } });
};

// Wraps an async route handler so thrown errors propagate to the middleware.
export const asyncHandler =
  <Req extends Request, Res extends Response>(fn: (req: Req, res: Res) => Promise<unknown>) =>
  (req: Req, res: Res, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

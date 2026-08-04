import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/http-error.js';
import { env } from '../env.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` },
  });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'validation_failed',
        message: 'Some fields are not valid',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'conflict', message: 'That value is already taken' },
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: { code: 'not_found', message: 'Not found' } });
    }
  }

  console.error('[kalba] unhandled error:', error);

  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong on our side',
      ...(env.isProduction ? {} : { details: String(error) }),
    },
  });
}

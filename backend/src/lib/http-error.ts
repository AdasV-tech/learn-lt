/** An error with an HTTP status attached, so route code can just throw. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, 'bad_request', details);

export const unauthorized = (message = 'Authentication required') =>
  new HttpError(401, message, 'unauthorized');

export const forbidden = (message = 'Not allowed') => new HttpError(403, message, 'forbidden');

export const notFound = (message = 'Not found') => new HttpError(404, message, 'not_found');

export const conflict = (message: string) => new HttpError(409, message, 'conflict');

export const tooMany = (message = 'Too many requests') =>
  new HttpError(429, message, 'rate_limited');

import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
} from '@nestjs/common';
import { resolveLocale, translateValidationMessage } from '@nublar/validation';
import type { Request, Response } from 'express';

/**
 * Schemas from @nublar/validation report message keys (see parseBody). This
 * turns them into text in the language the request asks for through
 * Accept-Language; other messages pass through unchanged.
 */
@Catch(BadRequestException)
export class ValidationMessageFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const locale = resolveLocale(request.headers['accept-language']);
    const body = exception.getResponse();
    const translate = (message: unknown) =>
      typeof message === 'string'
        ? translateValidationMessage(message, locale)
        : message;

    response.status(exception.getStatus()).json(
      typeof body === 'object' && body !== null && 'message' in body
        ? {
            ...body,
            message: Array.isArray(body.message)
              ? body.message.map(translate)
              : translate(body.message),
          }
        : body,
    );
  }
}

import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { ValidationMessageFilter } from './validation-message.filter';

function hostFor(acceptLanguage?: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {},
      }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('ValidationMessageFilter', () => {
  const filter = new ValidationMessageFilter();

  it('translates a schema message key into the requested language', () => {
    const { host, status, json } = hostFor('en-US,en;q=0.9');
    filter.catch(new BadRequestException('chooseCategory'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Choose a category',
        statusCode: 400,
      }),
    );
  });

  it('uses pt-BR when the request names no language', () => {
    const { host, json } = hostFor();
    filter.catch(new BadRequestException('chooseCategory'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Escolha uma categoria' }),
    );
  });

  it('keeps any other message as it is', () => {
    const { host, json } = hostFor('en');
    filter.catch(new BadRequestException('Cartão não encontrado'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Cartão não encontrado' }),
    );
  });
});

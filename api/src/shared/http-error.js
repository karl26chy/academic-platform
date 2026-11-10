/** Error de dominio que el manejador central traduce a una respuesta HTTP. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (message = 'Recurso no encontrado.') => new HttpError(404, message);

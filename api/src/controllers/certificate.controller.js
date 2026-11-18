import * as service from '../services/certificate.service.js';

export async function upload(req, res, next) {
  try {
    res.status(201).json(await service.upload(req.user, req.params.studentId, req.query.titulo, req.body));
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    res.json(await service.listOfStudent(req.user, req.params.studentId));
  } catch (err) {
    next(err);
  }
}

/** Nombre de archivo seguro para la cabecera (sin tildes ni comillas). */
function nombreAscii(nombre) {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ._-]/g, '')
    .trim();
  return limpio || 'certificado.pdf';
}

export async function download(req, res, next) {
  try {
    const { titulo, archivo } = await service.download(req.user, req.params.id);
    const nombre = `${titulo}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreAscii(nombre)}"; filename*=UTF-8''${encodeURIComponent(nombre)}`
    );
    res.send(archivo);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    res.json(await service.remove(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
}

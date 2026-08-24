import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cache = new Map();

export const templates = [
  {
    id: 'default',
    name: 'Formato por defecto',
    htmlPath: 'default/template.html',
    cssPath: 'default/style.css',
  },
  {
    id: 'liceo',
    name: 'Liceo Alegre Juventud',
    htmlPath: 'liceo/template.html',
    cssPath: 'liceo/style.css',
  },
];

export function getTemplateById(id) {
  const entry = templates.find(t => t.id === id);
  if (!entry) return null;
  if (!cache.has(id)) {
    let html = fs.readFileSync(path.join(here, entry.htmlPath), 'utf8');
    const css = fs.readFileSync(path.join(here, entry.cssPath), 'utf8');

    // Si existe carpeta .img/ dentro del template, inyectar imágenes como data URI
    const imgDir = path.join(here, path.dirname(entry.htmlPath), '.img');
    const images = {};
    if (fs.existsSync(imgDir)) {
      const files = fs.readdirSync(imgDir);
      for (const file of files) {
        const filePath = path.join(imgDir, file);
        if (fs.statSync(filePath).isFile()) {
          const buffer = fs.readFileSync(filePath);
          const base64 = buffer.toString('base64');
          const ext = path.extname(file).toLowerCase();
          let mime = 'image/png';
          if (ext === '.webp') mime = 'image/webp';
          else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
          else if (ext === '.svg') mime = 'image/svg+xml';
          else if (ext === '.gif') mime = 'image/gif';
          else if (ext === '.png') mime = 'image/png';
          images[file] = `data:${mime};base64,${base64}`;
        }
      }
      // Reemplazar src=".img/NOMBRE" por data URI antes de cachear
      html = html.replace(/src=["']\.img\/([^"']+)["']/g, (match, nombre) => {
        const dataUri = images[nombre];
        if (dataUri) return `src="${dataUri}"`;
        return match;
      });
    }

    cache.set(id, { ...entry, html, css, images });
  }
  return cache.get(id);
}

export function listTemplates() {
  return templates.map(t => ({ id: t.id, name: t.name }));
}

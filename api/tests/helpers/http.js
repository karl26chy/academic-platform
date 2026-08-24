/**
 * Se resuelve en cada llamada, no al importar: el runner define API_URL
 * después de que los imports se hayan evaluado.
 */
export const baseUrl = () => (process.env.API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

export async function request(method, path, { token, body, rawHeaders } = {}) {
  const headers = { ...(rawHeaders || {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

export const get = (path, token) => request('GET', path, { token });
export const post = (path, body, token) => request('POST', path, { token, body });
export const put = (path, body, token) => request('PUT', path, { token, body });
export const patch = (path, body, token) => request('PATCH', path, { token, body });
export const del = (path, token) => request('DELETE', path, { token });

export async function login(email, password) {
  const res = await post('/auth/login', { email, password });
  if (res.status !== 200) {
    throw new Error(`Login falló para ${email}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

/** Login de estudiante: solo identificación + contraseña (sin institución). */
export async function loginStudent(identificacion, password) {
  const res = await post('/auth/login', { identificacion, password });
  if (res.status !== 200) {
    throw new Error(`Login falló para identificación ${identificacion}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

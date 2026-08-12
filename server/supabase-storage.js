/**
 * Uploads de prints no Supabase Storage (plano free: 1 GB).
 * Cadastros (lideranças/mobilizadores) continuam no Postgres via DATABASE_URL —
 * Storage é quota separada e não compete com o banco de 500 MB.
 *
 * Env:
 *   SUPABASE_URL                 — https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    — service_role (Settings → API)
 *   SUPABASE_STORAGE_BUCKET      — opcional (default: atlas-demands)
 */

const DEFAULT_BUCKET = 'atlas-demands';

function configured() {
  return Boolean(
    String(process.env.SUPABASE_URL || '').trim()
    && String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  );
}

function baseUrl() {
  return String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
}

function bucketName() {
  return String(process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET).trim() || DEFAULT_BUCKET;
}

function headers(extra = {}) {
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  if (!configured()) return;

  const bucket = bucketName();
  const listRes = await fetch(`${baseUrl()}/storage/v1/bucket/${bucket}`, {
    headers: headers(),
  });

  if (listRes.ok) {
    bucketReady = true;
    return;
  }

  const createRes = await fetch(`${baseUrl()}/storage/v1/bucket`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: true,
      fileSizeLimit: 6 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    }),
  });

  if (!createRes.ok && createRes.status !== 409) {
    const text = await createRes.text().catch(() => '');
    const err = new Error(`Falha ao criar bucket Supabase Storage: ${createRes.status} ${text}`);
    err.status = 502;
    throw err;
  }

  bucketReady = true;
}

/**
 * @param {Buffer} buffer
 * @param {{ mimeType: string, filename: string, folder?: string }} opts
 * @returns {Promise<{ url: string, path: string, provider: 'supabase' }>}
 */
async function uploadPublicImage(buffer, { mimeType, filename, folder = 'demands' } = {}) {
  if (!configured()) {
    const err = new Error('Supabase Storage não configurado');
    err.status = 503;
    throw err;
  }

  await ensureBucket();

  const bucket = bucketName();
  const safeName = String(filename || 'print.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `${folder}/${safeName}`;

  const uploadRes = await fetch(
    `${baseUrl()}/storage/v1/object/${bucket}/${objectPath}`,
    {
      method: 'POST',
      headers: headers({
        'Content-Type': mimeType || 'application/octet-stream',
        'x-upsert': 'true',
      }),
      body: buffer,
    },
  );

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    const err = new Error(`Upload Supabase falhou: ${uploadRes.status} ${text}`);
    err.status = 502;
    throw err;
  }

  const url = `${baseUrl()}/storage/v1/object/public/${bucket}/${objectPath}`;
  return { url, path: objectPath, provider: 'supabase' };
}

function status() {
  return {
    configured: configured(),
    provider: configured() ? 'supabase' : 'local',
    bucket: configured() ? bucketName() : null,
  };
}

module.exports = {
  configured,
  uploadPublicImage,
  ensureBucket,
  status,
  bucketName,
};

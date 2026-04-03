import 'dotenv/config';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// ── ADDED ────────────────────────────────────────────────────────────────────
import { recordUpstream } from './observability.js';
// ────────────────────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
});

export const BUCKET = process.env.S3_BUCKET_NAME;

export const s3Get = async (key) => {
  // ── ADDED ──────────────────────────────────────────────────────────────────
  const start = Date.now();
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body.transformToString();
    recordUpstream('s3', true, Date.now() - start, 'get');
    return JSON.parse(body);
  } catch (err) {
    recordUpstream('s3', false, Date.now() - start, 'get');
    throw err;
  }
  // ── END ADDED ──────────────────────────────────────────────────────────────
};

export const s3Put = async (key, data) => {
  // ── ADDED ──────────────────────────────────────────────────────────────────
  const start = Date.now();
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
      }),
    );
    recordUpstream('s3', true, Date.now() - start, 'put');
  } catch (err) {
    recordUpstream('s3', false, Date.now() - start, 'put');
    throw err;
  }
  // ── END ADDED ──────────────────────────────────────────────────────────────
};

export const s3List = async (prefix) => {
  // ── ADDED ──────────────────────────────────────────────────────────────────
  const start = Date.now();
  try {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
    recordUpstream('s3', true, Date.now() - start, 'list');
    return (res.Contents || []).map((obj) => obj.Key);
  } catch (err) {
    recordUpstream('s3', false, Date.now() - start, 'list');
    throw err;
  }
  // ── END ADDED ──────────────────────────────────────────────────────────────
};
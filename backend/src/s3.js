import 'dotenv/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { recordUpstream } from './observability.js';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
});

export const BUCKET = process.env.S3_BUCKET_NAME;
const PUBLIC_URL = `https://${BUCKET}.s3.amazonaws.com`;

export const s3Get = async (key) => {
  const start = Date.now();
  try {
    const res = await fetch(`${PUBLIC_URL}/${key}`);
    if (!res.ok) throw new Error(`S3 public read failed: ${res.status}`);
    const data = await res.json();
    recordUpstream('s3', true, Date.now() - start, 'get');
    return data;
  } catch (err) {
    recordUpstream('s3', false, Date.now() - start, 'get');
    throw err;
  }
};

export const s3Put = async (key, data) => {
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
};

export const s3List = async (prefix) => {
  const start = Date.now();
  try {
    const url = `https://${BUCKET}.s3.us-east-1.amazonaws.com/?list-type=2&prefix=${prefix}`;
    const res = await fetch(url);
    if (!res.ok) {
      recordUpstream('s3', false, Date.now() - start, 'list');
      return [];
    }
    const xml = await res.text();
    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
    recordUpstream('s3', true, Date.now() - start, 'list');
    return keys;
  } catch (_err) {
    recordUpstream('s3', false, Date.now() - start, 'list');
    return [];
  }
};

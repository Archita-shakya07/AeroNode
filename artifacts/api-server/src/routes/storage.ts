import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
} from 'fs';
import path from 'path';

import { requireAuth } from '../middlewares/require-auth';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const pump = promisify(pipeline);

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Protected by our JWT-based requireAuth middleware (this project uses its
 * own email/password auth, not Replit Auth) so public callers cannot mint
 * write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    // Files uploaded via this app always belong to a workspace whose
    // membership is enforced at the metadata layer (see routes/files.ts):
    // anyone who can see the file record's objectPath was already checked
    // for workspace membership there. This route just streams bytes.

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

/**
 * POST /storage/uploads/local
 *
 * Local disk fallback for environments without Replit Object Storage configured.
 * The client streams the raw file bytes and receives an objectPath compatible
 * with the existing files metadata flow.
 */
router.post('/storage/uploads/local', requireAuth, async (req, res) => {
  const fileName = req.headers['x-file-name'];
  const contentType = req.headers['x-file-content-type'] || 'application/octet-stream';
  const size = parseInt((req.headers['x-file-size'] as string) || '0', 10);

  if (!fileName || Array.isArray(fileName)) {
    res.status(400).json({ error: 'Missing X-File-Name header' });
    return;
  }

  const safeName = `${Date.now()}-${path.basename(fileName)}`;
  const filePath = path.join(UPLOAD_DIR, safeName);

  try {
    await pump(req, createWriteStream(filePath));

    res.status(201).json({
      objectPath: `/uploads/${safeName}`,
      fileName,
      contentType,
      size,
    });
  } catch (error) {
    req.log.error({ err: error }, 'Error saving local upload');
    res.status(500).json({ error: 'Failed to save file' });
  }
});

/**
 * GET /storage/uploads/:filename
 *
 * Serve files uploaded via the local disk fallback.
 */
router.get('/storage/uploads/:filename', async (req, res) => {
  try {
    const filePath = path.join(UPLOAD_DIR, path.basename(req.params.filename));
    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.sendFile(filePath);
  } catch (error) {
    req.log.error({ err: error }, 'Error serving local upload');
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;

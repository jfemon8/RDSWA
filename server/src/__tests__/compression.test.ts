import express from 'express';
import compression from 'compression';
import request from 'supertest';
import app from '../app';

describe('response compression', () => {
  it('is wired into the app ahead of the routes', () => {
    const stack = (app as any)._router.stack.map((layer: any) => layer.name);
    expect(stack).toContain('compression');
    expect(stack.indexOf('compression')).toBeLessThan(stack.lastIndexOf('router'));
  });

  it('gzips a payload the size of an export', async () => {
    const probe = express();
    probe.use(compression());
    const rows = Array.from({ length: 200 }, (_, i) => `"Member ${i}","member${i}@example.com","01710000000"`);
    probe.get('/export.csv', (_req, res) => {
      res.type('text/csv').send(rows.join('\n'));
    });

    const gzipped = await request(probe).get('/export.csv').set('Accept-Encoding', 'gzip');
    const plain = await request(probe).get('/export.csv').set('Accept-Encoding', 'identity');

    expect(gzipped.headers['content-encoding']).toBe('gzip');
    expect(plain.headers['content-encoding']).toBeUndefined();
    // supertest decodes the body, so the saved content is the same either way.
    expect(gzipped.text).toBe(plain.text);
  });

  it('leaves an already-compressed download alone', async () => {
    const probe = express();
    probe.use(compression());
    probe.get('/file.pdf', (_req, res) => {
      res.type('application/pdf').send(Buffer.alloc(4096, 1));
    });

    const res = await request(probe).get('/file.pdf').set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBeUndefined();
  });
});

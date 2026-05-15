import express, { Request } from 'express';
import cors from 'cors';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { routes } from './routes';
import './types'; // ensure Express Request augmentation is loaded

export function createApp() {
  const app = express();

  app.use(cors({
    origin: [
      'https://authentic-comfort-production-f2fa.up.railway.app',
      'http://localhost:3000',
    ],
    credentials: true,
  }));

  // Capture raw body for Meta HMAC signature verification
  // rawBody is declared on Express.Request in src/types/index.ts
  app.use(
    express.json({
      verify: (req: Request, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  app.use(requestLogger);

  // All routes
  app.use('/', routes);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}

export { config };

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import apiRoutes from './routes';
import { apiRateLimiter } from './middleware/rateLimit.middleware';
import { notFoundHandler, globalErrorHandler } from './middleware/error.middleware';

const app = express();
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', apiRateLimiter, apiRoutes);
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;

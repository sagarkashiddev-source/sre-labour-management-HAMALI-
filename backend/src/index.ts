import express from 'express';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import entryRoutes from './routes/entry.routes';
import companyRoutes from './routes/company.routes';
import vehicleTypeRoutes from './routes/vehicleType.routes';
import attendanceRoutes from './routes/attendance.routes';
import reportRoutes from './routes/report.routes';
import auditLogRoutes from './routes/auditLog.routes';
import calculationRuleRoutes from './routes/calculationRule.routes';
import { prisma } from './lib/prisma';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/vehicle-types', vehicleTypeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/calculation-rules', calculationRuleRoutes);

// Phase 5+ will add: notifications, PWA/offline sync, duplicate-entry
// override UI, frontend

// --- Serve the built frontend (production) ------------------------------
// Deploys as ONE Railway service: this Express app answers /api/* itself
// and, for everything else, serves frontend/dist (a sibling folder — see
// root package.json's build script, which builds the frontend first).
// This keeps frontend + backend on the exact same origin, which matters
// because the frontend's httpOnly login cookie is sameSite:'lax' — that
// only survives if there's no cross-site request happening at all. Two
// separate Railway services (different subdomains) would need
// sameSite:'none' + cross-site cookie handling instead; same-origin avoids
// that whole class of problem.
if (env.nodeEnv === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Wrap async route handlers so thrown errors reach errorHandler.
// (Using express-async-errors would remove the need for this; kept explicit
// here so Phase 1 has zero implicit magic.)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use(errorHandler);

const server = app.listen(env.port, () => {
  console.log(`SRE backend listening on port ${env.port} (${env.nodeEnv})`);
});

// Close the single shared PrismaClient's connection pool cleanly when
// Railway (or any host) sends a shutdown signal, instead of leaving
// connections open until the process is killed outright.
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down.`);
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

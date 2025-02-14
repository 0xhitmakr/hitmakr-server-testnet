import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import connectDB from './config/db.js';
import multer from 'multer';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

// Route imports
import uploadRoutes from './routes/uploadRoutes.js';
import feedbackRoutes from "./routes/feedbackRoutes.js";
import copyrightRoutes from './routes/copyrightRoutes.js';
import dsrcRoutes from "./routes/dsrcRoutes.js";
import playlistRoutes from "./routes/playlistRoutes.js";
import dsrcCopyrightRoutes from './routes/dsrcCopyrightRoutes.js';
import followRoutes from './routes/followRoutes.js';
import heartRoutes from './routes/heartRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import songRoutes from "./routes/songRoutes.js";
import userRoutes from './routes/userRoutes.js';

dotenv.config();

// Database connection
await connectDB();

const app = express();

// CORS Configuration
const corsOptions = {
  origin: [
    'http://localhost:7000',
    'http://localhost:3000',
    'https://devnet.hitmakr.io'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-chain-id',
    'X-Chain-Id',
    'x-user-address',
    'X-User-Address',
    'x-nonce-token',
    'X-Nonce-Token',
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers'
  ],
  exposedHeaders: [
    'Authorization',
    'x-chain-id',
    'X-Chain-Id',
    'x-user-address',
    'X-User-Address',
    'x-nonce-token',
    'X-Nonce-Token'
  ],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Security configurations
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});
app.use(limiter);

// Compression
app.use(compression({
  level: 6,
  threshold: 10 * 1024 // only compress responses > 10KB
}));

// Logging
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  skip: (req) => req.path === '/health'
}));

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

// Body parsing middleware
const bodyParserConfig = {
  limit: '100mb',
  extended: true,
  parameterLimit: 100000
};

app.use(bodyParser.json(bodyParserConfig));
app.use(bodyParser.urlencoded(bodyParserConfig));
app.use(express.json(bodyParserConfig));
app.use(express.urlencoded(bodyParserConfig));

// Trust proxy in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Routes
const apiRoutes = [
  { path: '/upload', router: uploadRoutes },
  { path: '/feedback', router: feedbackRoutes },
  { path: '/copyright', router: copyrightRoutes },
  { path: '/dsrc', router: dsrcRoutes },
  { path: '/playlist', router: playlistRoutes },
  { path: '/dsrc-copyright', router: dsrcCopyrightRoutes },
  { path: '/follow', router: followRoutes },
  { path: '/heart', router: heartRoutes },
  { path: '/comment', router: commentRoutes },
  { path: '/song', router: songRoutes },
  { path: '/user', router: userRoutes }
];

apiRoutes.forEach(({ path, router }) => {
  app.use(path, cors(corsOptions), router);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Request logging middleware
app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error details:', err);
  
  const errorResponse = {
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message,
    status: err.status || 500
  };

  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }
  
  res.status(errorResponse.status).json(errorResponse);
});

// Graceful shutdown handlers
const gracefulShutdown = () => {
  console.log('Received shutdown signal. Closing HTTP server...');
  // Add any cleanup logic here (e.g., closing database connections)
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;
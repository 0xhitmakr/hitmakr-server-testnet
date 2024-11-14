import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import connectDB from './config/db.js';
import uploadRoutes from './routes/uploadRoutes.js';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
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

connectDB();

const app = express();

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000
});
app.use(limiter);

app.use(compression());

const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use('/upload', uploadRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/copyright', copyrightRoutes);
app.use("/dsrc", dsrcRoutes);
app.use("/playlist", playlistRoutes);
app.use('/dsrc-copyright', dsrcCopyrightRoutes);
app.use('/follow', followRoutes);
app.use('/heart', heartRoutes);
app.use('/comment', commentRoutes);
app.use('/song', songRoutes);
app.use('/user', userRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const error = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
  
  res.status(err.status || 500).json({ error });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Performing graceful shutdown...');
  process.exit(0);
});

export default app;
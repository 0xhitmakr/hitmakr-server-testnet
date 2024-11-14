import express from 'express';
import cors from 'cors';
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

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 

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

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

export default app;
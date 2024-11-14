import express from 'express';
import * as songController from '../controllers/songController.js';

const router = express.Router();

router.get('/search', songController.searchSongs);
router.get('/recent', songController.getRecentSongs);
router.get('/song/:songId', songController.getSongById);
router.get('/chain/:chainId', songController.getSongsByChain);
router.get('/wallet/:walletAddress', songController.getSongsByWallet);


export default router;
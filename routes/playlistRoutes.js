import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as playlistController from '../controllers/playlistController.js';

const router = express.Router();

router.post('/playlists', verifyToken, playlistController.createPlaylist);
router.get('/playlists', verifyToken, playlistController.getPaginatedPlaylists);
router.get('/playlists/:playlistId', verifyToken, playlistController.getPlaylist);
router.put('/playlists/:playlistId', verifyToken, playlistController.updatePlaylist);
router.delete('/playlists/:playlistId', verifyToken, playlistController.deletePlaylist);

router.get('/playlists/:playlistId/tracks', verifyToken, playlistController.getPaginatedTracks);
router.post('/playlists/:playlistId/tracks', verifyToken, playlistController.addTracks);
router.delete('/playlists/:playlistId/tracks', verifyToken, playlistController.removeTracks);
router.put('/playlists/:playlistId/tracks/order', verifyToken, playlistController.reorderTracks);

router.get('/public-playlists', verifyToken, playlistController.getPaginatedPublicPlaylists);

router.get('/playlists/search', verifyToken, playlistController.searchPaginatedPlaylists);
router.post('/playlists/:playlistId/clone', verifyToken, playlistController.clonePlaylist);

export default router;
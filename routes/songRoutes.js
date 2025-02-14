import express from "express";
import * as songController from "../controllers/songController.js";

const router = express.Router();

router.get("/search", songController.searchSongs);
router.get("/recent", songController.getRecentSongs);
router.get("/recent", songController.getRecentSongs);
router.get("/dsrc/:dsrcId", songController.getSongByDSRC);
router.get("/chain/:chainId", songController.getSongsByChain);
router.get("/wallet/:walletAddress", songController.getSongsByWallet);
router.post("/hashtags", songController.addHashtags);
router.put("/hashtags", songController.deleteHashtag);
router.get("/genre/:genre", songController.getSongByGenre);
router.get("/category/:category", songController.getSongByCategory);

export default router;

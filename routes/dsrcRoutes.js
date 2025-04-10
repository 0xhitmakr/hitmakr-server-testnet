// routes/dsrcRoutes.js
import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  createDSRC,
  getDSRCById,
  getDSRCsByCreator,
  getDSRCByAddress,
  getDSRCsByChain,
} from "../controllers/dsrcController.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiters
const createDSRCLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many DSRC creation attempts. Please try again later.",
  },
});

const queryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Allow more requests for queries
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// Create DSRC - requires auth
router.post("/create", [verifyToken, createDSRCLimiter], createDSRC);

// Get DSRC by ID
router.get("/id/:dsrcId", queryLimiter, getDSRCById);

// Get DSRCs by Creator with pagination
router.get("/creator/:creator", queryLimiter, getDSRCsByCreator);

// Get DSRC by Contract Address
router.get("/address/:contractAddress", queryLimiter, getDSRCByAddress);

// Get DSRCs by Chain with pagination
router.get("/chain/:chain", queryLimiter, getDSRCsByChain);

export default router;

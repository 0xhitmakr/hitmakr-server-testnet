// routes/collectionRoutes.js
import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  createCollection,
  getCollection,
  getUserCollections,
  updateCollection,
  addTracks,
  getPublicCollections,
  searchCollections,
  getPaginatedCollections,
  getPaginatedTracks,
  getCollectionsByType,
} from "../controllers/collectionController.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiters
const createCollectionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Lower limit for collection creation
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many collection creation attempts. Please try again later.",
  },
});

const updateCollectionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many collection update attempts. Please try again later.",
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

// Collection CRUD Operations
router.post(
  "/collections",
  [verifyToken, createCollectionLimiter],
  createCollection
);
router.get("/collections/:collectionId", queryLimiter, getCollection);
router.put(
  "/collections/:collectionId",
  [verifyToken, updateCollectionLimiter],
  updateCollection
);

// User Collections
router.get(
  "/user-collections",
  [verifyToken, queryLimiter],
  getUserCollections
);
router.get(
  "/user-collections/paginated",
  [verifyToken, queryLimiter],
  getPaginatedCollections
);

// Track Management
router.post("/collections/:collectionId/tracks", verifyToken, addTracks);

router.get(
  "/collections/:collectionId/tracks",
  queryLimiter,
  getPaginatedTracks
);

// Collection Discovery
router.get("/public-collections", queryLimiter, getPublicCollections);

router.get("/search-collections", queryLimiter, searchCollections);

// Collection Type Filtering
router.get("/collections/type/:type", queryLimiter, getCollectionsByType);

export default router;

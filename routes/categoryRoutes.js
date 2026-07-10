// backend/routes/categoryRoutes.js

import express from "express";
import {
  createCategory,
  getCategories,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { upload } from "../config/cloudinary.js";

const router = express.Router();

// ============================================================
// 🌐 المسارات العامة — لا تحتاج مصادقة
// ============================================================

router.get("/", getCategories);
router.get("/:slug", getCategoryBySlug);

// ============================================================
// 👑 مسارات الأدمن — تتطلب مصادقة + صلاحية أدمن
// ============================================================

router.post("/", protect, adminOnly, upload.single("image"), createCategory);
router
  .route("/:id")
  .put(protect, adminOnly, upload.single("image"), updateCategory)
  .delete(protect, adminOnly, deleteCategory);

export default router;

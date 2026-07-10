// backend/routes/productRoutes.js

import express from "express";
import {
  createProduct,
  getProducts,
  getProductBySlug,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { upload } from "../config/cloudinary.js";

const router = express.Router();

// ============================================================
// 🌐 المسارات العامة — لا تحتاج مصادقة
// ============================================================

router.get("/", getProducts);
router.get("/:slug", getProductBySlug);

// ============================================================
// 👑 مسارات الأدمن — تتطلب مصادقة + صلاحية أدمن
// ============================================================

// ✅ upload.array("images", 8) → بيسمح بـ 8 صور كحد أقصى بحقل اسمه "images"
router.post("/", protect, adminOnly, upload.array("images", 8), createProduct);

router
  .route("/:id")
  .put(protect, adminOnly, upload.array("images", 8), updateProduct)
  .delete(protect, adminOnly, deleteProduct);

export default router;

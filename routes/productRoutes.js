import express from "express";
import {
  createProduct,
  getProducts,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  createProductReview, // 👈 إضافة
  deleteProductReview, // 👈 إضافة
} from "../controllers/productController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { upload } from "../config/cloudinary.js";

const router = express.Router();

// 🌐 المسارات العامة
router.get("/", getProducts);
router.get("/:slug", getProductBySlug);

// ⭐ إضافة تقييم (مستخدم مسجل دخول)
router.post("/:id/reviews", protect, createProductReview);

// 👑 حذف تقييم (أدمن فقط)
router.delete("/:id/reviews/:reviewId", protect, deleteProductReview);

// 👑 مسارات الأدمن للمنتجات
router.post("/", protect, adminOnly, upload.array("images", 8), createProduct);

router
  .route("/:id")
  .put(protect, adminOnly, upload.array("images", 8), updateProduct)
  .delete(protect, adminOnly, deleteProduct);

export default router;

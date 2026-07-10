// backend/routes/cartRoutes.js

import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ============================================================
// 🔒 كل مسارات السلة تتطلب تسجيل دخول (حسب طلبك: بدون Guest Cart)
// ============================================================

router.get("/", protect, getCart);
router.post("/", protect, addToCart);
router.put("/", protect, updateCartItem);
router.delete("/clear", protect, clearCart);
router.delete("/:productId", protect, removeCartItem);

export default router;

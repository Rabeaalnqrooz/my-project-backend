// backend/routes/orderRoutes.js

import express from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelMyOrder,
} from "../controllers/orderController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// ============================================================
// 🔒 مسارات المستخدم المسجل
// ============================================================

router.post("/", protect, createOrder);
router.get("/my-orders", protect, getMyOrders);
router.put("/:id/cancel", protect, cancelMyOrder);

// ============================================================
// 👑 مسارات الأدمن
// ============================================================

router.get("/", protect, adminOnly, getAllOrders);
router.put("/:id/status", protect, adminOnly, updateOrderStatus);

// ============================================================
// 🌐 مسار مشترك (صاحب الطلب أو الأدمن) — الحماية جوا الكنترولر نفسه
// ============================================================

router.get("/:id", protect, getOrderById);

export default router;

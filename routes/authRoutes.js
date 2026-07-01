// backend/routes/authRoutes.js

import express from "express";
import {
  register,
  verifyUserEmail,
  login,
  refreshToken, // 👈 تم استيراد دالة التجديد هنا
  logout,
  getMe,
  resendVerification,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  resendResetOTP,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserRole,
  disableUser,
  enableUser,
  updateProfile,
  updatePassword,
} from "../controllers/authController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { upload } from "../config/cloudinary.js";
import { authLimiter } from "../middleware/rateLimiterMiddleware.js";

const router = express.Router();

// ============================================================
// 🌐 المسارات العامة — لا تحتاج مصادقة
// ============================================================

// ─── التسجيل وتفعيل الحساب ─────────────────────────────────
router.post("/register", authLimiter, register);
router.get("/verify/:token", verifyUserEmail);
router.post("/resend-verification", authLimiter, resendVerification);

// ─── تسجيل الدخول والخروج والتجديد ──────────────────────────
router.post("/login", authLimiter, login);
router.post("/refresh-token", refreshToken); // 👈 مسار التجديد التلقائي (يفضل تركه بدون limiter مكثف حتى لا يعطل تجديد جلسة المستخدم الطبيعي)

// ─── إعادة تعيين كلمة المرور ───────────────────────────────
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/verify-reset-otp", authLimiter, verifyResetOTP);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/resend-reset-otp", authLimiter, resendResetOTP);

// ============================================================
// 🔐 المسارات المحمية — تتطلب تسجيل الدخول
// ============================================================

router.post("/logout", protect, logout);
router.get("/me", protect, getMe);
router.put(
  "/update-profile",
  protect,
  upload.single("profilePic"),
  updateProfile,
);
router.put("/update-password", protect, updatePassword);

// ============================================================
// 👑 مسارات الأدمن — تتطلب مصادقة + صلاحية أدمن
// ============================================================

router.route("/users").get(protect, adminOnly, getAllUsers);

router
  .route("/users/:id")
  .get(protect, adminOnly, getUserById)
  .delete(protect, adminOnly, deleteUser);

router.put("/users/:id/role", protect, adminOnly, updateUserRole);
router.put("/users/:id/disable", protect, adminOnly, disableUser);
router.put("/users/:id/enable", protect, adminOnly, enableUser);

export default router;

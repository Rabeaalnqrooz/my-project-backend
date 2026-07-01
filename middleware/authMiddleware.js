// backend/middleware/authMiddleware.js

import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";

// ============================================================
// 🔐 PROTECT — حماية المسارات (يتطلب تسجيل الدخول)
// ============================================================

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // ─── 1️⃣ البحث عن التوكن في الـ Cookie الجديدة (accessToken) ───────────────
  // ✅ تم التعديل هنا ليقرأ accessToken بدلاً من jwt ليواكب نظام الـ Refresh Token
  if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  // ─── 2️⃣ إذا لم يوجد في Cookie، نبحث في Authorization header ─
  // هذا يدعم استخدام الـ API من تطبيقات Mobile أو Postman
  else if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // ─── 3️⃣ لا يوجد توكن على الإطلاق ──────────────────────────
  if (!token) {
    res.status(401);
    throw new Error("غير مصرح: لا يوجد توكن، يرجى تسجيل الدخول");
  }

  // ─── 4️⃣ فك تشفير التوكن والتحقق من صحته ───────────────────
  // jwt.verify يرمي خطأ تلقائياً إذا انتهت صلاحية الـ accessToken (15 دقيقة)
  // وعندها يتدخل الـ interceptor في الفرونت إيند ليطلب التجديد تلقائياً بالخلفية
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // ─── 5️⃣ التحقق من أن التوكن ليس لإعادة تعيين كلمة المرور ──
  if (decoded.purpose === "reset-password") {
    res.status(401);
    throw new Error("غير مصرح: هذا التوكن مخصص لإعادة تعيين كلمة المرور فقط");
  }

  // ─── 6️⃣ البحث عن المستخدم في قاعدة البيانات ───────────────
  const user = await User.findById(decoded.userId).select(
    "-password -otp -otpExpiry -emailVerifyToken -emailVerifyTokenExpiry",
  );

  if (!user) {
    res.status(401);
    throw new Error("غير مصرح: المستخدم غير موجود");
  }

  // ─── 7️⃣ التحقق من أن الحساب غير معطل ──────────────────────
  if (user.role === "disabled") {
    res.status(403);
    throw new Error("هذا الحساب معطل، يرجى التواصل مع الدعم");
  }

  // ─── 8️⃣ إرفاق المستخدم بالـ request للاستخدام في المسارات ─
  req.user = user;
  next();
});

// ============================================================
// 👑 ADMIN ONLY — مسارات الأدمن فقط
// ============================================================

export const adminOnly = (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error("غير مصرح: يرجى تسجيل الدخول أولاً");
  }

  if (req.user.role !== "admin") {
    res.status(403);
    throw new Error("غير مصرح: هذه الصفحة مخصصة للمديرين فقط");
  }

  next();
};

// ============================================================
// ✅ VERIFIED ONLY — للمستخدمين المحققين فقط (اختياري)
// ============================================================

export const verifiedOnly = (req, res, next) => {
  if (!req.user?.isVerified) {
    res.status(403);
    throw new Error("يرجى التحقق من بريدك الإلكتروني أولاً للوصول لهذه الصفحة");
  }

  next();
};

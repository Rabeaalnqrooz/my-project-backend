import rateLimit from "express-rate-limit";
// ─── Rate Limiting العام — لجميع المسارات ──────────────────
// ✅ يمنع إرسال آلاف الطلبات في وقت قصير (DDoS protection)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // نافذة زمنية: 15 دقيقة
  max: 100, // 100 طلب كحد أقصى لكل IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "طلبات كثيرة جداً من هذا العنوان، يرجى المحاولة بعد 15 دقيقة",
  },
});
// ─── Rate Limiting المشدد — للمسارات الحساسة ───────────────
// ✅ يمنع هجمات Brute Force على تسجيل الدخول وإعادة التعيين
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 50, // 10 محاولات فقط
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "محاولات كثيرة جداً، يرجى المحاولة بعد 15 دقيقة",
  },
});

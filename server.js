// backend/server.js

import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { globalLimiter } from "./middleware/rateLimiterMiddleware.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
// ============================================================
// ⚙️ تحميل متغيرات البيئة — يجب أن يكون أول شيء
// ============================================================
dotenv.config();

// ============================================================
// 🗄️ الاتصال بقاعدة البيانات
// ============================================================
connectDB();

// ============================================================
// 🚀 إنشاء تطبيق Express
// ============================================================
const app = express();

// ============================================================
// 🛡️ SECURITY MIDDLEWARE — طبقات الأمان
// ============================================================

// ─── Helmet — تأمين HTTP Headers تلقائياً ──────────────────
// يضيف headers مهمة مثل:
// X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security
app.use(helmet());

app.use(globalLimiter);

// ─── CORS — السماح بالطلبات من الـ Frontend فقط ────────────
app.use(
  cors({
    // ✅ نأخذ الرابط من .env — في الإنتاج يكون رابط الموقع الحقيقي
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true, // ضروري لإرسال واستقبال الـ Cookies
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── Body Parsers ───────────────────────────────────────────
// ✅ limit: "10kb" يمنع هجمات الـ Payload الضخمة
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ─── NoSQL Injection Protection ─────────────────────────────
// ✅ يمنع هجمات NoSQL Injection على MongoDB
// مثال هجوم: { "email": { "$gt": "" }, "password": { "$gt": "" } }
// بدون هذه الحماية قد يتجاوز المهاجم تسجيل الدخول بالكامل

const sanitize = (obj) => {
  // نتحقق أن القيمة موجودة وأنها كائن (object)
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (key.startsWith("$") || key.includes(".")) {
        // ✅ نحذف أي مفتاح يبدأ بـ $ (مثل $gt, $where, $ne)
        // أو يحتوي على . (مثل admin.password) — هذه مؤشرات هجوم
        delete obj[key];
      } else {
        // ✅ تطبيق متكرر (Recursive) على الكائنات المتداخلة
        // مثال: { "user": { "email": { "$gt": "" } } }
        sanitize(obj[key]);
      }
    }
  }
};

app.use((req, res, next) => {
  sanitize(req.body); // تنظيف بيانات الـ Body
  sanitize(req.params); // تنظيف بيانات الـ URL Parameters
  next(); // المتابعة للـ middleware التالي
});

// ============================================================
// 🛤️ ROUTES — المسارات
// ============================================================

// ─── مسار اختبار الـ API ─────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 API is running...",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── مسارات المصادقة ─────────────────────────────────────────
// ✅ authLimiter مُطبق هنا على جميع مسارات /api/v1/user
// يمكن تطبيقه بشكل أدق في authRoutes.js على مسارات محددة
app.use("/api/v1/user", authRoutes);
app.use("/api/v1/category", categoryRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/order", orderRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
// ============================================================
// ❌ ERROR HANDLERS — معالجة الأخطاء
// يجب أن يكونا آخر شيء دائماً
// ============================================================

// ─── 404 — مسار غير موجود ───────────────────────────────────
app.use(notFound);

// ─── معالج الأخطاء العام ─────────────────────────────────────
app.use(errorHandler);

// ============================================================
// 🎧 START SERVER — تشغيل الخادم
// ============================================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(
    `🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
  );
});

// ============================================================
// 🔴 UNHANDLED ERRORS — معالجة الأخطاء غير المتوقعة
// ============================================================

// ─── Unhandled Promise Rejections ───────────────────────────
// ✅ يمسك أي Promise فشل بدون .catch()
// مثال: فشل اتصال قاعدة البيانات بعد التشغيل
process.on("unhandledRejection", (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  // نغلق الخادم بشكل نظيف ثم نوقف العملية
  server.close(() => process.exit(1));
});

// ─── Uncaught Exceptions ────────────────────────────────────
// ✅ يمسك أي خطأ غير متوقع في الكود المتزامن
// مثال: قراءة متغير غير معرّف
process.on("uncaughtException", (err) => {
  console.error(`❌ Uncaught Exception: ${err.message}`);
  server.close(() => process.exit(1));
});

export default app;

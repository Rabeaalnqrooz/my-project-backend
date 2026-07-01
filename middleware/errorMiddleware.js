// backend/middleware/errorMiddleware.js

// ============================================================
// 🔍 NOT FOUND — للتعامل مع المسارات غير الموجودة (404)
// ============================================================

export const notFound = (req, res, next) => {
  const error = new Error(`الصفحة غير موجودة - ${req.originalUrl}`);
  res.status(404);
  next(error); // نمرر الخطأ لـ errorHandler
};

// ============================================================
// 🚨 ERROR HANDLER — معالج الأخطاء الأساسي
// يجب أن يكون آخر middleware في server.js
// Express يتعرف عليه تلقائياً لوجود 4 معاملات (err, req, res, next)
// ============================================================

export const errorHandler = (err, req, res, next) => {
  // ─── 1️⃣ تحديد الـ Status Code ─────────────────────────────
  // إذا كان الكود 200 (القيمة الافتراضية) نحوله لـ 500
  // هذا يحدث عندما نرمي خطأ بدون تحديد status مسبقاً
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // ─── 2️⃣ خطأ MongoDB — Duplicate Key (11000) ───────────────
  // يحدث عند محاولة تسجيل إيميل موجود مسبقاً (unique: true)
  if (err.code === 11000) {
    statusCode = 400;
    // ✅ نستخرج اسم الحقل المكرر من الخطأ ديناميكياً
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `هذا ${field} مسجل بالفعل` : "هذه القيمة مسجلة بالفعل";
  }

  // ─── 3️⃣ خطأ Mongoose — Validation Error ───────────────────
  // يحدث عند فشل التحقق من البيانات في الـ Schema
  // مثال: إيميل غير صالح، اسم قصير جداً، حقل مطلوب فارغ
  if (err.name === "ValidationError") {
    statusCode = 400;
    // ✅ نجمع كل رسائل الخطأ في نص واحد
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // ─── 4️⃣ خطأ Mongoose — Cast Error ─────────────────────────
  // يحدث عند تمرير ID غير صالح لـ MongoDB
  // مثال: /users/abc بدلاً من /users/64f1a2b3c4d5e6f7a8b9c0d1
  if (err.name === "CastError") {
    statusCode = 400;
    message = `معرّف غير صالح: ${err.value}`;
  }

  // ─── 5️⃣ خطأ JWT — توكن غير صالح ───────────────────────────
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "توكن غير صالح، يرجى تسجيل الدخول مجدداً";
  }

  // ─── 6️⃣ خطأ JWT — توكن منتهي الصلاحية ────────────────────
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "انتهت صلاحية التوكن، يرجى تسجيل الدخول مجدداً";
  }

  // ─── 7️⃣ خطأ JWT — لم يبدأ بعد (نادر) ─────────────────────
  if (err.name === "NotBeforeError") {
    statusCode = 401;
    message = "التوكن غير نشط بعد، يرجى المحاولة لاحقاً";
  }

  // ─── 8️⃣ إرسال الاستجابة ────────────────────────────────────
  res.status(statusCode).json({
    success: false,
    message,
    // ✅ نُظهر stack trace فقط في بيئة التطوير — لا في الإنتاج
    // هذا يمنع كشف تفاصيل داخلية للمهاجمين
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

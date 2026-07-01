// backend/config/db.js

import mongoose from "mongoose";

// ============================================================
// 🗄️ CONNECT DB — الاتصال بقاعدة البيانات MongoDB
// ============================================================

const connectDB = async () => {
  try {
    // ─── 1️⃣ الاتصال بـ MongoDB ────────────────────────────────
    const conn = await mongoose.connect(process.env.MONGO_URL, {
      // ✅ هذه الخيارات تمنع تحذيرات Mongoose وتحسن الأداء
      serverSelectionTimeoutMS: 5000, // انتظر 5 ثواني قبل الفشل
      socketTimeoutMS: 45000, // أغلق الاتصال بعد 45 ثانية من الخمول
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // ─── 2️⃣ معالجة خطأ الاتصال ──────────────────────────────
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);
    // ✅ نوقف التطبيق فوراً — لا فائدة من تشغيله بدون قاعدة بيانات
    process.exit(1);
  }
};

// ============================================================
// 🔌 DISCONNECT DB — قطع الاتصال (مفيد في الاختبارات)
// ============================================================

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log("✅ MongoDB Disconnected");
  } catch (error) {
    console.error(`❌ MongoDB Disconnect Failed: ${error.message}`);
  }
};

// ============================================================
// 📡 CONNECTION EVENTS — مراقبة حالة الاتصال
// ============================================================

// ✅ تسجيل أحداث الاتصال للمراقبة في بيئة الإنتاج
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB Disconnected — محاولة إعادة الاتصال...");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB Reconnected");
});

// ✅ إغلاق الاتصال بشكل نظيف عند إيقاف التطبيق
// SIGINT = Ctrl+C في الـ Terminal
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("✅ MongoDB Connection Closed — تم إغلاق التطبيق بشكل نظيف");
  process.exit(0);
});

export default connectDB;

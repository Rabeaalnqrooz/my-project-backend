// backend/models/cartModel.js

import mongoose from "mongoose";

// ============================================================
// 📌 SCHEMA DEFINITION — تعريف هيكل بيانات عنصر واحد بالسلة
// ============================================================

// ✅ نعرّفها كـ sub-schema منفصل عشان نستخدمها جوا array بالـ Cart
const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "الكمية يجب أن تكون 1 على الأقل"],
      default: 1,
    },
  },
  { _id: false }, // ✅ ما بدنا _id منفصل لكل عنصر، الـ product id كافي للتمييز
);

// ============================================================
// 📌 SCHEMA DEFINITION — السلة الرئيسية
// ============================================================

const cartSchema = new mongoose.Schema(
  {
    // ─── ربط السلة بمستخدم واحد فقط ──────────────────────────
    // ✅ حسب طلبك: بدون Guest Cart، كل مستخدم مسجل له سلة واحدة بس
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // ✅ يمنع إنشاء أكثر من سلة لنفس المستخدم
    },

    // ─── عناصر السلة ──────────────────────────────────────────
    items: [cartItemSchema],
  },
  {
    timestamps: true,
  },
);

// ============================================================
// 📤 EXPORT
// ============================================================

export const Cart = mongoose.model("Cart", cartSchema);

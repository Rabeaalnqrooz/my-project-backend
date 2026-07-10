// backend/models/orderModel.js

import mongoose from "mongoose";

// ============================================================
// 📌 SCHEMA DEFINITION — عنصر واحد بالطلب (Snapshot من المنتج)
// ============================================================

// ⚠️ نقطة مهمة جداً: هون (بعكس الـ Cart) بنخزن نسخة (snapshot) من
// اسم المنتج وسعره لحظة الطلب. ليش؟ لأنه الطلب مستند تاريخي/قانوني —
// لو تغيّر اسم المنتج أو سعره بعدين، فاتورة الطلب القديم لازم تضل
// عارضة نفس السعر يلي دفعه الزبون بالضبط، مش السعر الحالي.
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true }, // ✅ السعر الفعلي المدفوع لكل وحدة
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

// ============================================================
// 📌 SCHEMA DEFINITION — عنوان الشحن
// ============================================================

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

// ============================================================
// 📌 SCHEMA DEFINITION — الطلب الرئيسي
// ============================================================

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "لا يمكن إنشاء طلب فارغ",
      },
    },

    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },

    // ─── طريقة الدفع — حسب طلبك: نقدي الآن + بوابة إلكترونية لاحقاً ─
    paymentMethod: {
      type: String,
      enum: ["cod", "online"], // cod = Cash On Delivery
      required: true,
      default: "cod",
    },

    // ─── حالة الدفع ───────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    // ─── حالة الطلب — دورة حياة الطلب كاملة ───────────────────
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },

    // ─── السعر الإجمالي (محسوب لحظة إنشاء الطلب) ───────────────
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // ─── هل تم خصم الكمية من المخزون فعلياً؟ ────────────────────
    // ✅ حسب طلبك: الخصم بيصير بس عند التأكيد، مش عند الإنشاء.
    // هاد الـ flag بيمنعنا نخصم المخزون مرتين بالغلط لو تم تحديث
    // حالة الطلب لـ "confirmed" أكثر من مرة بالخطأ من لوحة الأدمن.
    stockDeducted: {
      type: Boolean,
      default: false,
    },

    // ─── تاريخ التسليم الفعلي (يتحدث لما تتغير الحالة لـ delivered) ─
    deliveredAt: {
      type: Date,
    },

    // ─── تاريخ الإلغاء (لو انلغى الطلب) ─────────────────────────
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// 📤 EXPORT
// ============================================================

export const Order = mongoose.model("Order", orderSchema);

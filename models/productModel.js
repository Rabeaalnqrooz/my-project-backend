// backend/models/productModel.js

import mongoose from "mongoose";

// ============================================================
// 📌 SCHEMA DEFINITION — تعريف هيكل بيانات المنتج (Product)
// ============================================================

const productSchema = new mongoose.Schema(
  {
    // ─── اسم المنتج ─────────────────────────────────────────
    name: {
      type: String,
      required: [true, "اسم المنتج مطلوب"],
      trim: true,
      minlength: [3, "اسم المنتج يجب أن يكون 3 أحرف على الأقل"],
      maxlength: [150, "اسم المنتج يجب ألا يتجاوز 150 حرف"],
    },

    // ─── الـ Slug — نسخة صديقة للـ URL ───────────────────────
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },

    // ─── العلامة التجارية (اختياري بس مفيد بالإلكترونيات) ────
    brand: {
      type: String,
      trim: true,
      default: "",
    },

    // ─── الوصف الكامل للمنتج ─────────────────────────────────
    // ✅ حسب طلبك: وصف نصي عادي بدل مواصفات ديناميكية
    description: {
      type: String,
      required: [true, "وصف المنتج مطلوب"],
      trim: true,
      maxlength: [3000, "الوصف يجب ألا يتجاوز 3000 حرف"],
    },

    // ─── ربط المنتج بتصنيف ───────────────────────────────────
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "التصنيف مطلوب"],
    },

    // ─── السعر الأصلي ─────────────────────────────────────────
    price: {
      type: Number,
      required: [true, "سعر المنتج مطلوب"],
      min: [0, "السعر لا يمكن أن يكون بالسالب"],
    },

    // ─── السعر بعد الخصم (اختياري) ───────────────────────────
    // ✅ لو ما في خصم، بنسيبه فاضي (undefined) بدل ما نحطه = السعر الأصلي
    discountPrice: {
      type: Number,
      min: [0, "سعر الخصم لا يمكن أن يكون بالسالب"],
      validate: {
        // ✅ يتأكد إنه سعر الخصم دايماً أقل من السعر الأصلي
        validator: function (value) {
          return value == null || value < this.price;
        },
        message: "سعر الخصم يجب أن يكون أقل من السعر الأصلي",
      },
    },

    // ─── الكمية المتوفرة بالمخزون ─────────────────────────────
    stock: {
      type: Number,
      required: [true, "الكمية بالمخزون مطلوبة"],
      min: [0, "الكمية لا يمكن أن تكون بالسالب"],
      default: 0,
    },

    // ─── معرض صور المنتج (Gallery) ───────────────────────────
    // ✅ حسب طلبك: أكثر من صورة، كل وحدة فيها url + publicId (لحذفها من Cloudinary لاحقاً)
    images: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, required: true },
        },
      ],
      validate: {
        // ✅ لازم صورة وحدة على الأقل عشان المنتج يظهر بشكل صحيح بالمتجر
        validator: function (arr) {
          return arr.length > 0;
        },
        message: "يجب رفع صورة واحدة على الأقل للمنتج",
      },
    },

    // ─── عداد المبيعات (بنحسبه لاحقاً عند كل طلب ناجح) ────────
    // ✅ مفيد لعرض "الأكثر مبيعاً" بالفرونت مستقبلاً
    sold: {
      type: Number,
      default: 0,
    },

    // ─── حالة المنتج — فعّال أو مخفي ─────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },

    // ─── مين أنشأ هذا المنتج ──────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// ⚙️ VIRTUAL — نسبة الخصم (منحسبها، ما بنخزنها)
// ============================================================

// ✅ virtual يعني حقل محسوب مش مخزن بقاعدة البيانات، بيتحسب كل مرة تطلبه
productSchema.virtual("discountPercentage").get(function () {
  if (!this.discountPrice) return 0;
  return Math.round(((this.price - this.discountPrice) / this.price) * 100);
});

// ✅ عشان الـ virtual يظهر لما نحول المستند لـ JSON (مثلاً بالـ API response)
productSchema.set("toJSON", { virtuals: true });

// ============================================================
// ⚙️ MIDDLEWARE — توليد الـ Slug تلقائياً قبل الحفظ
// ============================================================

// ⚠️ ملاحظة: Mongoose 9 — بدون next()، نفس مبدأ Category model
productSchema.pre("save", function () {
  if (this.isModified("name")) {
    this.slug = this.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
      .replace(/\s+/g, "-");
  }
});

// ============================================================
// 🔍 INDEX — لتسريع البحث بالاسم والفلترة بالتصنيف
// ============================================================

productSchema.index({ category: 1 });

// ============================================================
// 📤 EXPORT
// ============================================================

export const Product = mongoose.model("Product", productSchema);

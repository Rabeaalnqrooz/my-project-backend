// backend/models/productModel.js

import mongoose from "mongoose";

// ============================================================
// 📌 REVIEW SCHEMA — هيكل التقييم الواحد
// ============================================================

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
      default: "عميل جوليا",
    },
    rating: {
      type: Number,
      required: [true, "التقييم بالنجوم مطلوب"],
      min: [1, "التقييم يجب أن يكون نجمة واحدة على الأقل"],
      max: [5, "التقييم يجب ألا يتجاوز 5 نجوم"],
    },
    comment: {
      type: String,
      required: [true, "نص التقييم مطلوب"],
      trim: true,
      maxlength: [1000, "التقييم يجب ألا يتجاوز 1000 حرف"],
    },
  },
  {
    timestamps: true, // يولد createdAt تلقائياً ليعطينا تاريخ التقييم
  },
);

// ============================================================
// 📌 PRODUCT SCHEMA — تعريف هيكل بيانات المنتج
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

    // ─── العلامة التجارية ──────────────────────────────────
    brand: {
      type: String,
      trim: true,
      default: "",
    },

    // ─── الوصف الكامل للمنتج ─────────────────────────────────
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

    // ─── السعر بعد الخصم ─────────────────────────────────────
    discountPrice: {
      type: Number,
      min: [0, "سعر الخصم لا يمكن أن يكون بالسالب"],
      validate: {
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

    // ─── معرض صور المنتج ─────────────────────────────────────
    images: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, required: true },
        },
      ],
      validate: {
        validator: function (arr) {
          return arr.length > 0;
        },
        message: "يجب رفع صورة واحدة على الأقل للمنتج",
      },
    },

    // ─── ⭐ التقييمات والمراجعات (القسم المضاف) ───────────────
    reviews: [reviewSchema],

    rating: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 5,
    },

    numReviews: {
      type: Number,
      required: true,
      default: 0,
    },

    // ─── عداد المبيعات ────────────────────────────────────────
    sold: {
      type: Number,
      default: 0,
    },

    // ─── حالة المنتج ─────────────────────────────────────────
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
// ⚙️ VIRTUAL — نسبة الخصم
// ============================================================

productSchema.virtual("discountPercentage").get(function () {
  if (!this.discountPrice) return 0;
  return Math.round(((this.price - this.discountPrice) / this.price) * 100);
});

productSchema.set("toJSON", { virtuals: true });

// ============================================================
// ⚙️ MIDDLEWARE — توليد الـ Slug تلقائياً قبل الحفظ
// ============================================================

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
// 🔍 INDEX
// ============================================================

productSchema.index({ category: 1 });

// ============================================================
// 📤 EXPORT
// ============================================================

export const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

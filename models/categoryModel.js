// backend/models/categoryModel.js

import mongoose from "mongoose";

// ============================================================
// 📌 SCHEMA DEFINITION — تعريف هيكل بيانات التصنيف (Category)
// ============================================================

const categorySchema = new mongoose.Schema(
  {
    // ─── اسم التصنيف ────────────────────────────────────────
    name: {
      type: String,
      required: [true, "اسم التصنيف مطلوب"],
      trim: true,
      unique: true, // ما بنسمح بتكرار نفس اسم التصنيف
      minlength: [2, "اسم التصنيف يجب أن يكون حرفين على الأقل"],
      maxlength: [50, "اسم التصنيف يجب أن يكون 50 حرف كحد أقصى"],
    },

    // ─── الـ Slug — نسخة صديقة للـ URL من الاسم ─────────────
    // ✅ يُستخدم في الروابط مثل: /category/laptops بدل /category/64f1a2b3
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },

    // ─── وصف مختصر للتصنيف (اختياري) ────────────────────────
    description: {
      type: String,
      trim: true,
      maxlength: [300, "الوصف يجب ألا يتجاوز 300 حرف"],
      default: "",
    },

    // ─── صورة التصنيف عبر Cloudinary ────────────────────────
    // نفس فكرة الصور بالـ userModel، بس هون إلزامية لأنها منتج/واجهة عرض
    image: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        // ✅ بنخزن الـ public_id عشان نقدر نحذف الصورة من Cloudinary لاحقاً
        type: String,
        default: "",
      },
    },

    // ─── حالة التصنيف — فعّال أو مخفي ────────────────────────
    // ✅ بدل ما نحذف تصنيف نهائياً، منعطله فقط (Soft Delete Pattern)
    isActive: {
      type: Boolean,
      default: true,
    },

    // ─── ترتيب العرض في الواجهة ──────────────────────────────
    // ✅ يسمح للأدمن يتحكم بترتيب ظهور التصنيفات (مثلاً: الأكثر أهمية أول)
    order: {
      type: Number,
      default: 0,
    },

    // ─── مين أنشأ هذا التصنيف (ربط بالأدمن) ──────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true, // ✅ يضيف createdAt و updatedAt تلقائياً
  },
);

// ============================================================
// ⚙️ MIDDLEWARE — توليد الـ Slug تلقائياً قبل الحفظ
// ============================================================

categorySchema.pre("save", function () {
  // ✅ نولّد الـ slug فقط إذا تغيّر الاسم (أو أول مرة بيتحفظ)
  if (this.isModified("name")) {
    this.slug = this.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "") // بيسمح بحروف عربي + إنجليزي + أرقام
      .replace(/\s+/g, "-"); // المسافات تتحول لـ -
  }
});

// ============================================================
// 📤 EXPORT
// ============================================================

export const Category = mongoose.model("Category", categorySchema);

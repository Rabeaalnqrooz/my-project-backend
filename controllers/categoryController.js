// backend/controllers/categoryController.js

import asyncHandler from "express-async-handler";
import { Category } from "../models/categoryModel.js";
import { cloudinary } from "../config/cloudinary.js";

// ============================================================
// ➕ CREATE CATEGORY — إنشاء تصنيف جديد (أدمن فقط)
// ============================================================

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, order } = req.body;

  if (!name) {
    res.status(400);
    throw new Error("اسم التصنيف مطلوب");
  }

  // ─── تجهيز بيانات التصنيف الأساسية ────────────────────────
  const categoryData = {
    name,
    description,
    order,
    createdBy: req.user._id, // ✅ جاي من الـ protect middleware
  };

  // ─── رفع الصورة إذا كانت موجودة ────────────────────────────
  // ✅ نفس نمط رفع الصور المستخدم بالـ authController تماماً
  if (req.file) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "ecommerce/categories",
          transformation: [{ width: 600, height: 600, crop: "fill" }],
          format: "webp",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(req.file.buffer);
    });

    categoryData.image = {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  // ─── الحفظ بقاعدة البيانات ──────────────────────────────────
  // ✅ لو الاسم مكرر، الـ errorMiddleware رح يلتقط خطأ الـ 11000 تلقائياً
  const category = await Category.create(categoryData);

  res.status(201).json({
    success: true,
    message: "تم إنشاء التصنيف بنجاح",
    category,
  });
});

// ============================================================
// 📋 GET ALL CATEGORIES — عرض كل التصنيفات
// ============================================================

export const getCategories = asyncHandler(async (req, res) => {
  // ✅ الزائر العادي يشوف بس التصنيفات الفعّالة
  // بينما الأدمن (لما نبني صفحة الإدارة) بيقدر يشوف الكل عبر ?all=true
  const filter = req.query.all === "true" ? {} : { isActive: true };

  const categories = await Category.find(filter).sort({
    order: 1,
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    count: categories.length,
    categories,
  });
});

// ============================================================
// 🔍 GET SINGLE CATEGORY — عرض تصنيف واحد (عبر slug)
// ============================================================

export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug });

  if (!category) {
    res.status(404);
    throw new Error("التصنيف غير موجود");
  }

  res.status(200).json({
    success: true,
    category,
  });
});

// ============================================================
// ✏️ UPDATE CATEGORY — تعديل تصنيف (أدمن فقط)
// ============================================================

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("التصنيف غير موجود");
  }

  category.name = req.body.name || category.name;
  category.description = req.body.description ?? category.description;
  category.order = req.body.order ?? category.order;

  if (typeof req.body.isActive !== "undefined") {
    category.isActive = req.body.isActive;
  }

  // ─── تحديث الصورة إذا رفع صورة جديدة ───────────────────────
  if (req.file) {
    // ✅ نحذف الصورة القديمة من Cloudinary أولاً (لو موجودة) لتفادي تراكم صور يتيمة
    if (category.image?.publicId) {
      await cloudinary.uploader.destroy(category.image.publicId);
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "ecommerce/categories",
          transformation: [{ width: 600, height: 600, crop: "fill" }],
          format: "webp",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(req.file.buffer);
    });

    category.image = {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  const updatedCategory = await category.save();

  res.status(200).json({
    success: true,
    message: "تم تحديث التصنيف بنجاح",
    category: updatedCategory,
  });
});

// ============================================================
// 🗑️ DELETE CATEGORY — حذف تصنيف (أدمن فقط)
// ============================================================

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("التصنيف غير موجود");
  }

  // ⚠️ ملاحظة مهمة: لما نبني Product Model بالمرحلة الجاية،
  // رح نضيف هون تحقق إنه ما فيه منتجات مرتبطة بهذا التصنيف قبل حذفه فعلياً
  // حالياً منسمح بالحذف المباشر لأنه ما في منتجات بعد

  if (category.image?.publicId) {
    await cloudinary.uploader.destroy(category.image.publicId);
  }

  await category.deleteOne();

  res.status(200).json({
    success: true,
    message: "تم حذف التصنيف بنجاح",
  });
});

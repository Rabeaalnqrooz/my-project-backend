// backend/controllers/productController.js

import asyncHandler from "express-async-handler";
import { Product } from "../models/productModel.js";
import { Category } from "../models/categoryModel.js";
import { cloudinary } from "../config/cloudinary.js";

// ============================================================
// 🔧 HELPER — رفع صورة واحدة على Cloudinary (نعيد استخدامها لكل صورة بالـ array)
// ============================================================

const uploadImageToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ecommerce/products",
        transformation: [
          { width: 800, height: 800, crop: "fill" },
          { fetch_format: "auto", quality: "auto" },
        ],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    stream.end(fileBuffer);
  });
};

// ============================================================
// ➕ CREATE PRODUCT — إنشاء منتج جديد (أدمن فقط)
// ============================================================

export const createProduct = asyncHandler(async (req, res) => {
  const { name, description, category, price, discountPrice, stock, brand } =
    req.body;

  if (!name || !description || !category || !price) {
    res.status(400);
    throw new Error("الاسم والوصف والتصنيف والسعر كلها حقول مطلوبة");
  }

  // ─── التأكد إنه التصنيف موجود فعلاً قبل الربط فيه ───────────
  // ✅ مهم جداً: منع إنشاء منتج مربوط بتصنيف وهمي أو محذوف
  const categoryExists = await Category.findById(category);
  if (!categoryExists) {
    res.status(404);
    throw new Error("التصنيف المحدد غير موجود");
  }

  // ─── لازم صورة وحدة على الأقل (متوافق مع الـ Schema validation) ─
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error("يجب رفع صورة واحدة على الأقل للمنتج");
  }

  // ─── رفع كل الصور بالتوازي (أسرع من رفعها وحدة وحدة) ─────────
  const uploadResults = await Promise.all(
    req.files.map((file) => uploadImageToCloudinary(file.buffer)),
  );

  const images = uploadResults.map((result) => ({
    url: result.secure_url,
    publicId: result.public_id,
  }));

  const product = await Product.create({
    name,
    description,
    category,
    price,
    discountPrice: discountPrice || undefined,
    stock,
    brand,
    images,
    createdBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: "تم إنشاء المنتج بنجاح",
    product,
  });
});

// ============================================================
// 📋 GET ALL PRODUCTS — عرض المنتجات مع فلترة، بحث، وتصفح (Pagination)
// ============================================================

export const getProducts = asyncHandler(async (req, res) => {
  const { category, search, minPrice, maxPrice, sort, page, limit } = req.query;

  // ─── بناء فلتر البحث ديناميكياً حسب الـ query params الموجودة ──
  const filter = req.query.all === "true" ? {} : { isActive: true };

  if (category) {
    filter.category = category; // ✅ فلترة حسب تصنيف معين (نبعت الـ id)
  }

  if (search) {
    // ✅ بحث جزئي (Partial Match) بغض النظر عن حالة الأحرف (case-insensitive)
    // بيبحث بالاسم وكمان بالوصف، وبيطابق أي جزء من النص مش كلمة كاملة بس
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  // ─── الترتيب ──────────────────────────────────────────────
  let sortOption = { createdAt: -1 }; // الافتراضي: الأحدث أولاً
  if (sort === "price_asc") sortOption = { price: 1 };
  if (sort === "price_desc") sortOption = { price: -1 };
  if (sort === "best_selling") sortOption = { sold: -1 };

  // ─── التصفح (Pagination) ────────────────────────────────────
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 12;
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug") // ✅ بنجيب اسم وslug التصنيف بدل ما نرجع الـ id بس
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    products,
  });
});

// ============================================================
// 🔍 GET SINGLE PRODUCT — عرض منتج واحد (عبر slug)
// ============================================================

export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug }).populate(
    "category",
    "name slug",
  );

  if (!product) {
    res.status(404);
    throw new Error("المنتج غير موجود");
  }

  res.status(200).json({
    success: true,
    product,
  });
});

// ============================================================
// ✏️ UPDATE PRODUCT — تعديل منتج (أدمن فقط)
// ============================================================

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("المنتج غير موجود");
  }

  // ─── لو غيّر التصنيف، نتأكد إنه موجود ────────────────────────
  if (req.body.category) {
    const categoryExists = await Category.findById(req.body.category);
    if (!categoryExists) {
      res.status(404);
      throw new Error("التصنيف المحدد غير موجود");
    }
    product.category = req.body.category;
  }

  product.name = req.body.name || product.name;
  product.description = req.body.description || product.description;
  product.brand = req.body.brand ?? product.brand;
  product.price = req.body.price ?? product.price;
  product.stock = req.body.stock ?? product.stock;

  // ✅ نسمح نمسح الخصم بالكامل لو بعتوا discountPrice = "" أو null صراحة
  if (typeof req.body.discountPrice !== "undefined") {
    product.discountPrice = req.body.discountPrice || undefined;
  }

  if (typeof req.body.isActive !== "undefined") {
    product.isActive = req.body.isActive;
  }

  // ─── حذف صور محددة (اختياري) ─────────────────────────────────
  // ✅ الفرونت بيبعت array من publicIds المراد حذفها: removeImages: ["id1", "id2"]
  if (req.body.removeImages) {
    const idsToRemove = Array.isArray(req.body.removeImages)
      ? req.body.removeImages
      : [req.body.removeImages];

    await Promise.all(
      idsToRemove.map((publicId) => cloudinary.uploader.destroy(publicId)),
    );

    product.images = product.images.filter(
      (img) => !idsToRemove.includes(img.publicId),
    );
  }

  // ─── إضافة صور جديدة (اختياري) ───────────────────────────────
  if (req.files && req.files.length > 0) {
    const uploadResults = await Promise.all(
      req.files.map((file) => uploadImageToCloudinary(file.buffer)),
    );

    const newImages = uploadResults.map((result) => ({
      url: result.secure_url,
      publicId: result.public_id,
    }));

    product.images.push(...newImages);
  }

  // ✅ لازم يضل عنده صورة وحدة على الأقل بعد كل التعديلات
  if (product.images.length === 0) {
    res.status(400);
    throw new Error("يجب أن يحتفظ المنتج بصورة واحدة على الأقل");
  }

  const updatedProduct = await product.save();

  res.status(200).json({
    success: true,
    message: "تم تحديث المنتج بنجاح",
    product: updatedProduct,
  });
});

// ============================================================
// 🗑️ DELETE PRODUCT — حذف منتج (أدمن فقط)
// ============================================================

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("المنتج غير موجود");
  }

  // ✅ حذف كل صور المنتج من Cloudinary قبل حذف المستند نفسه
  await Promise.all(
    product.images.map((img) => cloudinary.uploader.destroy(img.publicId)),
  );

  await product.deleteOne();

  res.status(200).json({
    success: true,
    message: "تم حذف المنتج بنجاح",
  });
});

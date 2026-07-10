// backend/controllers/cartController.js

import asyncHandler from "express-async-handler";
import { Cart } from "../models/cartModel.js";
import { Product } from "../models/productModel.js";

// ============================================================
// 🔧 HELPER — جلب سلة المستخدم مع بيانات المنتجات كاملة
// ============================================================

const getPopulatedCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate(
    "items.product",
    "name slug price discountPrice images stock isActive",
  );

  if (!cart) return null;

  // ✅ تنظيف ذاتي (Self-Healing): أي عنصر بالسلة منتجه محذوف فعلياً من
  // قاعدة البيانات (populate رجّعت null له)، منشيله تلقائياً ونحفظ التغيير.
  // هيك بنضمن إنه السلة يلي بترجع للفرونت اند دايماً "نظيفة" 100%، ومافي
  // داعي الفرونت يتوقع أو يتعامل مع بيانات منتج مفقودة أصلاً.
  const hasGhostItems = cart.items.some((item) => !item.product);
  if (hasGhostItems) {
    cart.items = cart.items.filter((item) => item.product);
    await cart.save();
  }

  return cart;
};

// ============================================================
// 📋 GET CART — عرض سلة المستخدم الحالي
// ============================================================

export const getCart = asyncHandler(async (req, res) => {
  let cart = await getPopulatedCart(req.user._id);

  // ✅ لو المستخدم أول مرة يفتح السلة وما عنده سلة أصلاً، منرجع سلة فاضية
  // بدل ما نرمي خطأ 404 — تجربة استخدام أفضل بالفرونت (سلة فاضية مش خطأ)
  if (!cart) {
    return res.status(200).json({
      success: true,
      cart: { items: [] },
    });
  }

  res.status(200).json({
    success: true,
    cart,
  });
});

// ============================================================
// ➕ ADD TO CART — إضافة منتج للسلة (أو زيادة كميته لو موجود)
// ============================================================

export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || !quantity || quantity < 1) {
    res.status(400);
    throw new Error("رقم المنتج والكمية (1 على الأقل) مطلوبين");
  }

  // ─── التأكد إنه المنتج موجود وفعّال ─────────────────────────
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    res.status(404);
    throw new Error("المنتج غير موجود أو غير متاح حالياً");
  }

  // ─── جلب سلة المستخدم، أو إنشاء وحدة جديدة لو ما عنده ────────
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = new Cart({ user: req.user._id, items: [] });
  }

  // ─── التحقق: هل المنتج موجود بالسلة أصلاً؟ ───────────────────
  const existingItem = cart.items.find(
    (item) => item.product.toString() === productId,
  );

  // ✅ الكمية الإجمالية المطلوبة = يلي موجود بالسلة (إن وجد) + الكمية الجديدة
  const totalRequestedQty = existingItem
    ? existingItem.quantity + Number(quantity)
    : Number(quantity);

  // ─── التحقق من توفر الكمية بالمخزون (حسب طلبك) ───────────────
  if (product.stock < totalRequestedQty) {
    res.status(400);
    throw new Error(
      `الكمية المتوفرة بالمخزون: ${product.stock} فقط، ولا يمكن إضافة الكمية المطلوبة`,
    );
  }

  if (existingItem) {
    existingItem.quantity = totalRequestedQty;
  } else {
    cart.items.push({ product: productId, quantity: Number(quantity) });
  }

  await cart.save();

  // ✅ منرجع السلة كاملة مع بيانات المنتجات (populate) بدل ما نرجع الحفظ الخام
  const populatedCart = await getPopulatedCart(req.user._id);

  res.status(200).json({
    success: true,
    message: "تمت إضافة المنتج للسلة بنجاح",
    cart: populatedCart,
  });
});

// ============================================================
// ✏️ UPDATE CART ITEM — تعديل كمية منتج بالسلة (تحديد قيمة مباشرة)
// ============================================================

export const updateCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || quantity == null || quantity < 1) {
    res.status(400);
    throw new Error("رقم المنتج والكمية (1 على الأقل) مطلوبين");
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error("السلة غير موجودة");
  }

  const item = cart.items.find((item) => item.product.toString() === productId);
  if (!item) {
    res.status(404);
    throw new Error("هذا المنتج غير موجود بالسلة");
  }

  // ─── التحقق من المخزون بناءً على القيمة الجديدة مباشرة ───────
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    res.status(404);
    throw new Error("المنتج غير موجود أو غير متاح حالياً");
  }

  if (product.stock < quantity) {
    res.status(400);
    throw new Error(`الكمية المتوفرة بالمخزون: ${product.stock} فقط`);
  }

  item.quantity = Number(quantity);
  await cart.save();

  const populatedCart = await getPopulatedCart(req.user._id);

  res.status(200).json({
    success: true,
    message: "تم تحديث الكمية بنجاح",
    cart: populatedCart,
  });
});

// ============================================================
// 🗑️ REMOVE CART ITEM — حذف منتج معيّن من السلة
// ============================================================

export const removeCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error("السلة غير موجودة");
  }

  const itemExists = cart.items.some(
    (item) => item.product.toString() === productId,
  );
  if (!itemExists) {
    res.status(404);
    throw new Error("هذا المنتج غير موجود بالسلة");
  }

  cart.items = cart.items.filter(
    (item) => item.product.toString() !== productId,
  );

  await cart.save();

  const populatedCart = await getPopulatedCart(req.user._id);

  res.status(200).json({
    success: true,
    message: "تم حذف المنتج من السلة",
    cart: populatedCart,
  });
});

// ============================================================
// 🧹 CLEAR CART — تفريغ السلة بالكامل
// ============================================================

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    res.status(404);
    throw new Error("السلة غير موجودة");
  }

  cart.items = [];
  await cart.save();

  res.status(200).json({
    success: true,
    message: "تم تفريغ السلة بنجاح",
    cart,
  });
});

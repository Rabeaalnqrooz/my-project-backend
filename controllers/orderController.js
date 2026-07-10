// backend/controllers/orderController.js

import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import { Order } from "../models/orderModel.js";
import { Cart } from "../models/cartModel.js";
import { Product } from "../models/productModel.js";

// ============================================================
// ➕ CREATE ORDER — إنشاء طلب من محتويات السلة الحالية
// ============================================================

export const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod } = req.body;

  if (!shippingAddress || !paymentMethod) {
    res.status(400);
    throw new Error("عنوان الشحن وطريقة الدفع مطلوبين");
  }

  // ─── جلب سلة المستخدم مع بيانات المنتجات كاملة ───────────────
  const cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product",
  );

  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error("السلة فارغة، لا يمكن إنشاء طلب");
  }

  // ─── التحقق: كل منتج بالسلة لسا فعّال ومتوفر بالكمية المطلوبة ──
  // ⚠️ هون بنتحقق بس (مو بنخصم) — الخصم الفعلي بيصير لاحقاً عند التأكيد
  for (const item of cart.items) {
    if (!item.product || !item.product.isActive) {
      res.status(400);
      throw new Error(
        `المنتج "${item.product?.name || "غير معروف"}" لم يعد متوفراً`,
      );
    }
    if (item.product.stock < item.quantity) {
      res.status(400);
      throw new Error(
        `الكمية المتوفرة من "${item.product.name}" هي ${item.product.stock} فقط`,
      );
    }
  }

  // ─── تجهيز snapshot لكل عنصر (اسم + صورة + سعر لحظة الطلب) ────
  const orderItems = cart.items.map((item) => ({
    product: item.product._id,
    name: item.product.name,
    image: item.product.images[0]?.url || "",
    // ✅ نأخذ السعر المخفض لو موجود، وإلا السعر الأصلي
    price: item.product.discountPrice || item.product.price,
    quantity: item.quantity,
  }));

  const totalPrice = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod,
    totalPrice,
  });

  // ─── تفريغ السلة بعد إنشاء الطلب بنجاح ────────────────────────
  cart.items = [];
  await cart.save();

  res.status(201).json({
    success: true,
    message: "تم إنشاء الطلب بنجاح، بانتظار التأكيد",
    order,
  });
});

// ============================================================
// 📋 GET MY ORDERS — عرض طلبات المستخدم الحالي
// ============================================================

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    orders,
  });
});

// ============================================================
// 🔍 GET SINGLE ORDER — عرض طلب واحد (صاحبه أو الأدمن فقط)
// ============================================================

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email",
  );

  if (!order) {
    res.status(404);
    throw new Error("الطلب غير موجود");
  }

  // ✅ حماية: المستخدم العادي بيقدر يشوف بس طلباته هو، مش طلبات غيره
  const isOwner = order.user._id.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== "admin") {
    res.status(403);
    throw new Error("غير مصرح لك بالاطلاع على هذا الطلب");
  }

  res.status(200).json({
    success: true,
    order,
  });
});

// ============================================================
// 📋 GET ALL ORDERS — عرض كل الطلبات (أدمن فقط)
// ============================================================

export const getAllOrders = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    filter.orderStatus = req.query.status;
  }

  const orders = await Order.find(filter)
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: orders.length,
    orders,
  });
});

// ============================================================
// ✏️ UPDATE ORDER STATUS — تغيير حالة الطلب (أدمن فقط)
// ============================================================
// ⚠️ هون قلب المرحلة كلها: خصم/استرجاع المخزون بشكل آمن (Transaction)

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = [
    "pending",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled",
  ];

  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error("حالة الطلب غير صالحة");
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("الطلب غير موجود");
  }

  // ============================================================
  // 🔒 حالة "التأكيد" → خصم المخزون فعلياً (مرة واحدة بس)
  // ============================================================
  if (status === "confirmed" && !order.stockDeducted) {
    // ✅ نفتح Session جديدة عشان نستخدم Transaction
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        for (const item of order.items) {
          // ✅ النقطة الأهم بكل المرحلة: شرط "stock >= quantity" جوا
          // نفس عملية التحديث. هيك مافي فجوة زمنية بين "نتحقق" و"نخصم"
          // حتى لو جت طلبات متزامنة بنفس الميلي ثانية على نفس المنتج،
          // MongoDB بتضمن إنه بس طلب واحد ينجح لو الكمية ما كانت كافية للاثنين.
          const updatedProduct = await Product.findOneAndUpdate(
            { _id: item.product, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity, sold: item.quantity } },
            { session, new: true },
          );

          if (!updatedProduct) {
            // ✅ لو رجعت null معناها الشرط فشل (مخزون غير كافي الآن)
            // رمي خطأ جوا transaction بيلغي كل العمليات يلي صارت قبله بنفس الـ loop
            throw new Error(
              `الكمية المتوفرة من "${item.name}" لم تعد كافية لتأكيد الطلب`,
            );
          }
        }

        order.stockDeducted = true;
        order.orderStatus = status;
        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      success: true,
      message: "تم تأكيد الطلب وخصم المخزون بنجاح",
      order,
    });
  }

  // ============================================================
  // 🔄 حالة "الإلغاء" → استرجاع المخزون (لو كان انخصم أصلاً)
  // ============================================================
  if (status === "cancelled" && order.stockDeducted) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity, sold: -item.quantity } },
            { session },
          );
        }

        order.stockDeducted = false;
        order.orderStatus = status;
        order.cancelledAt = new Date();
        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      success: true,
      message: "تم إلغاء الطلب واسترجاع المخزون بنجاح",
      order,
    });
  }

  // ============================================================
  // ⚪ أي حالة تانية (shipped, delivered, أو cancelled قبل التأكيد)
  // ============================================================
  order.orderStatus = status;
  if (status === "delivered") {
    order.deliveredAt = new Date();
    order.paymentStatus = "paid"; // ✅ افتراض منطقي: لو COD ووصل، معناته انَدفع
  }
  if (status === "cancelled") {
    order.cancelledAt = new Date();
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: "تم تحديث حالة الطلب بنجاح",
    order,
  });
});

// ============================================================
// ❌ CANCEL MY ORDER — المستخدم يلغي طلبه بنفسه
// ============================================================

export const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("الطلب غير موجود");
  }

  if (order.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("غير مصرح لك بإلغاء هذا الطلب");
  }

  // ✅ المستخدم يقدر يلغي بس لو الطلب لسا ما انشحن
  if (["shipped", "delivered", "cancelled"].includes(order.orderStatus)) {
    res.status(400);
    throw new Error("لا يمكن إلغاء الطلب في هذه المرحلة");
  }

  // ─── استرجاع المخزون لو كان انخصم (يعني الطلب كان confirmed) ───
  if (order.stockDeducted) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity, sold: -item.quantity } },
            { session },
          );
        }
        order.stockDeducted = false;
        order.orderStatus = "cancelled";
        order.cancelledAt = new Date();
        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }
  } else {
    order.orderStatus = "cancelled";
    order.cancelledAt = new Date();
    await order.save();
  }

  res.status(200).json({
    success: true,
    message: "تم إلغاء الطلب بنجاح",
    order,
  });
});

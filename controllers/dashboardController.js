// backend/controllers/dashboardController.js

import asyncHandler from "express-async-handler";
import { Order } from "../models/orderModel.js";
import { Product } from "../models/productModel.js";
import { User } from "../models/userModel.js";

// ============================================================
// 📊 GET DASHBOARD STATS — مؤشرات سريعة للوحة الرئيسية (أدمن فقط)
// ============================================================

export const getDashboardStats = asyncHandler(async (req, res) => {
  // ✅ كل الاستعلامات بتشتغل بالتوازي (Promise.all) بدل التسلسل — أسرع بكثير
  const [
    revenueResult,
    pendingOrdersCount,
    totalOrders,
    totalProducts,
    totalUsers,
    recentOrders,
  ] = await Promise.all([
    // ─── إجمالي المبيعات — بس من الطلبات المؤكدة فعلياً (مو الملغية أو المعلقة) ─
    Order.aggregate([
      {
        $match: {
          orderStatus: { $in: ["confirmed", "shipped", "delivered"] },
        },
      },
      {
        $group: { _id: null, total: { $sum: "$totalPrice" } },
      },
    ]),

    Order.countDocuments({ orderStatus: "pending" }),
    Order.countDocuments(),
    Product.countDocuments({ isActive: true }),
    User.countDocuments(),

    // ─── آخر 5 طلبات (للعرض السريع باللوحة الرئيسية) ─────────
    Order.find()
      .populate("user", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      // ✅ لو ما في أي طلب مؤكد أصلاً، aggregate بترجع array فاضية — نتعامل معها بـ ?.
      totalRevenue: revenueResult[0]?.total || 0,
      pendingOrdersCount,
      totalOrders,
      totalProducts,
      totalUsers,
      recentOrders,
    },
  });
});

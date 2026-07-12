// backend/controllers/authController.js

import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/userModel.js";
import { verifyEmail } from "../emailVerify/verifyEmail.js";
import { sendOTPMail } from "../emailVerify/sendOTPMail.js";
import { cloudinary } from "../config/cloudinary.js";

// ============================================================
// 🔧 HELPER — توليد Access Token و Refresh Token وإرسالهم في Cookies منفصلة
// ============================================================

const sendTokenResponse = (user, statusCode, res) => {
  // 1️⃣ توليد Access Token (صلاحية قصيرة لحماية الطلبات المستمرة)
  const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m", // 15 دقيقة افتراضياً
  });

  // 2️⃣ توليد Refresh Token (صلاحية طويلة لتجديد الجلسة)
  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d", // 7 أيام
    },
  );

  // 3️⃣ إعدادات الـ Cookies الآمنة
  const commonCookieOptions = {
    httpOnly: true, // حماية من وصول JavaScript بالمتصفح
    secure: true, // إجبار HTTPS وهو مدعوم تلقائياً على Render و Vercel
    sameSite: "none", // مصيري جداً للسماح بتبادل الكوكيز عبر النطاقات المختلفة أونلاين
  };

  // 4️⃣ إرسال الاستجابة مع الكوكيز وتحديث البيانات
  res
    .status(statusCode)
    .cookie("accessToken", accessToken, {
      ...commonCookieOptions,
      maxAge: 15 * 60 * 1000, // 15 دقيقة بالميلي ثانية
    })
    .cookie("refreshToken", refreshToken, {
      ...commonCookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 أيام بالميلي ثانية
    })
    .json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profilePic: user.profilePic,
      },
    });
};

// ============================================================
// 🔄 REFRESH TOKEN — تجديد الـ Access Token تلقائياً بالخلفية
// POST /api/v1/user/refresh-token
// ============================================================

export const refreshToken = asyncHandler(async (req, res) => {
  // 1️⃣ قراءة الـ Refresh Token من الكوكيز المرفقة تلقائياً
  const token = req.cookies.refreshToken;

  if (!token) {
    res.status(401);
    throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مجدداً");
  }

  // 2️⃣ التحقق من صحة التوكن وفك تشفيره
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    res.status(401);
    throw new Error("جلسة غير صالحة، يرجى تسجيل الدخول مجدداً");
  }

  // 3️⃣ البحث عن المستخدم للتأكد أن حسابه لا يزال نشطاً ولم يُعطل
  const user = await User.findById(decoded.userId);
  if (!user || user.role === "disabled") {
    res.status(403);
    throw new Error("الحساب معطل أو غير موجود");
  }

  // 4️⃣ توليد Access Token جديد تماماً
  const newAccessToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    },
  );

  // 5️⃣ إرسال الـ Access Token الجديد في الكوكي الخاصة به
  res
    .status(200)
    .cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: true, // إجبار True أونلاين
      sameSite: "none", // إجبار None أونلاين
      maxAge: 15 * 60 * 1000,
    })
    .json({
      success: true,
      message: "تم تجديد الجلسة بنجاح",
    });
});

// ============================================================
// 📝 REGISTER — تسجيل مستخدم جديد
// POST /api/v1/user/register
// ============================================================

export const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    res.status(400);
    throw new Error("جميع الحقول مطلوبة");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(400);
    throw new Error("هذا البريد الإلكتروني مسجل بالفعل");
  }

  const user = await User.create({ firstName, lastName, email, password });

  const rawToken = user.generateEmailVerifyToken();
  await user.save({ validateBeforeSave: false });

  // ✅ التعديل العبقري: أزلنا await وجعلنا الإرسال يتم في الخلفية مع الإمساك بالخطأ لو حدث دون تعطيل المستخدم
  verifyEmail(rawToken, user.email).catch((err) => {
    console.error("❌ فشل إرسال بريد التحقق خلف الكواليس:", err.message);
  });

  // 🎉 الآن السيرفر سيرد فوراً على الـ Frontend خلال أجزاء من الثانية!
  res.status(201).json({
    success: true,
    message: "تم إنشاء الحساب بنجاح، تحقق من بريدك الإلكتروني لتفعيل الحساب",
  });
});

// ============================================================
// ✅ VERIFY USER EMAIL — التحقق من البريد الإلكتروني
// GET /api/v1/user/verify/:token
// ============================================================

export const verifyUserEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    emailVerifyToken: hashedToken,
    emailVerifyTokenExpiry: { $gt: Date.now() },
  }).select("+emailVerifyToken +emailVerifyTokenExpiry");

  if (!user) {
    res.status(400);
    throw new Error("رابط التحقق غير صالح أو منتهي الصلاحية");
  }

  user.isVerified = true;
  user.clearEmailVerifyToken();
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "تم التحقق من البريد الإلكتروني بنجاح، يمكنك الآن تسجيل الدخول",
  });
});

// ============================================================
// 🔄 RESEND VERIFICATION — إعادة إرسال إيميل التحقق
// POST /api/v1/user/resend-verification
// ============================================================

export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("البريد الإلكتروني مطلوب");
  }

  const user = await User.findOne({ email }).select(
    "+emailVerifyToken +emailVerifyTokenExpiry",
  );

  if (!user) {
    res.status(404);
    throw new Error("لا يوجد حساب بهذا البريد الإلكتروني");
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error("هذا الحساب محقق بالفعل");
  }

  if (user.emailVerifyTokenExpiry && user.emailVerifyTokenExpiry > Date.now()) {
    res.status(429);
    throw new Error(
      "تم إرسال إيميل تحقق مؤخراً، يرجى الانتظار قبل المحاولة مجدداً",
    );
  }

  const rawToken = user.generateEmailVerifyToken();
  await user.save({ validateBeforeSave: false });
  await verifyEmail(rawToken, user.email);

  res.status(200).json({
    success: true,
    message: "تم إعادة إرسال إيميل التحقق",
  });
});

// ============================================================
// 🔑 LOGIN — تسجيل الدخول
// POST /api/v1/user/login
// ============================================================

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("البريد الإلكتروني وكلمة المرور مطلوبان");
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    res.status(401);
    throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
  }

  const isPasswordMatch = await user.matchPassword(password);
  if (!isPasswordMatch) {
    res.status(401);
    throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
  }

  if (!user.isVerified) {
    res.status(403);
    throw new Error("يرجى التحقق من بريدك الإلكتروني أولاً لتفعيل الحساب");
  }

  if (user.role === "disabled") {
    res.status(403);
    throw new Error("هذا الحساب معطل، يرجى التواصل مع الدعم");
  }

  // إرسال الكوكيز الجديدة المحدثة (Access + Refresh)
  sendTokenResponse(user, 200, res);
});

// ============================================================
// 🚪 LOGOUT — تسجيل الخروج ومسح الكوكيز بالكامل
// POST /api/v1/user/logout
// ============================================================

export const logout = asyncHandler(async (req, res) => {
  res
    .cookie("accessToken", "", { httpOnly: true, expires: new Date(0) })
    .cookie("refreshToken", "", { httpOnly: true, expires: new Date(0) })
    .status(200)
    .json({
      success: true,
      message: "تم تسجيل الخروج بنجاح",
    });
});

// ============================================================
// 👤 GET ME — بيانات المستخدم الحالي
// GET /api/v1/user/me
// ============================================================

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("المستخدم غير موجود");
  }

  res.status(200).json({
    success: true,
    user,
  });
});

// ============================================================
// 🔓 FORGOT PASSWORD — طلب إعادة تعيين كلمة المرور
// POST /api/v1/user/forgot-password
// ============================================================

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("البريد الإلكتروني مطلوب");
  }

  const user = await User.findOne({ email }).select("+otp +otpExpiry");

  if (!user) {
    return res.status(200).json({
      success: true,
      message: "إذا كان البريد مسجلاً، ستصلك رسالة OTP",
    });
  }

  if (user.otpExpiry && user.otpExpiry > Date.now()) {
    res.status(429);
    throw new Error("تم إرسال OTP مؤخراً، يرجى الانتظار 10 دقائق");
  }

  const rawOTP = user.generateOTP();
  await user.save({ validateBeforeSave: false });

  await sendOTPMail(rawOTP, user.email);

  res.status(200).json({
    success: true,
    message: "إذا كان البريد مسجلاً، ستصلك رسالة OTP",
  });
});

// ============================================================
// 🔢 VERIFY RESET OTP — التحقق من OTP
// POST /api/v1/user/verify-reset-otp
// ============================================================

export const verifyResetOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error("البريد الإلكتروني وكود OTP مطلوبان");
  }

  const user = await User.findOne({ email }).select("+otp +otpExpiry");

  if (!user) {
    res.status(404);
    throw new Error("لا يوجد حساب بهذا البريد الإلكتروني");
  }

  const isValid = user.verifyOTP(otp);

  if (!isValid) {
    res.status(400);
    throw new Error("كود OTP غير صحيح أو منتهي الصلاحية");
  }

  const resetToken = jwt.sign(
    { userId: user._id, purpose: "reset-password" },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  user.clearOTP();
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "تم التحقق من OTP بنجاح",
    resetToken,
  });
});

// ============================================================
// 🔄 RESEND RESET OTP — إعادة إرسال OTP
// POST /api/v1/user/resend-reset-otp
// ============================================================

export const resendResetOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("البريد الإلكتروني مطلوب");
  }

  const user = await User.findOne({ email }).select("+otp +otpExpiry");

  if (!user) {
    return res.status(200).json({
      success: true,
      message: "إذا كان البريد مسجلاً، ستصلك رسالة OTP جديدة",
    });
  }

  if (user.otpExpiry && user.otpExpiry > Date.now()) {
    res.status(429);
    throw new Error("تم إرسال OTP مؤخراً، يرجى الانتظار قبل المحاولة مجدداً");
  }

  const rawOTP = user.generateOTP();
  await user.save({ validateBeforeSave: false });
  await sendOTPMail(rawOTP, user.email);

  res.status(200).json({
    success: true,
    message: "إذا كان البريد مسجلاً، ستصلك رسالة OTP جديدة",
  });
});

// ============================================================
// 🔐 RESET PASSWORD — إعادة تعيين كلمة المرور
// POST /api/v1/user/reset-password
// ============================================================

export const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword, confirmPassword } = req.body;

  if (!resetToken || !newPassword || !confirmPassword) {
    res.status(400);
    throw new Error("جميع الحقول مطلوبة");
  }

  if (newPassword !== confirmPassword) {
    res.status(400);
    throw new Error("كلمتا المرور غير متطابقتان");
  }

  let decoded;
  try {
    decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
  } catch {
    res.status(400);
    throw new Error("رابط إعادة التعيين غير صالح أو منتهي الصلاحية");
  }

  if (decoded.purpose !== "reset-password") {
    res.status(400);
    throw new Error("توكن غير صالح");
  }

  const user = await User.findById(decoded.userId).select("+password");

  if (!user) {
    res.status(404);
    throw new Error("المستخدم غير موجود");
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: "تم إعادة تعيين كلمة المرور بنجاح، يمكنك الآن تسجيل الدخول",
  });
});

// ============================================================
// 👑 ADMIN — مسارات الأدمن
// ============================================================

export const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    users,
  });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("المستخدم غير موجود");
  }

  res.status(200).json({ success: true, user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("المستخدم غير موجود");
  }

  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error("لا يمكنك حذف حسابك الخاص");
  }

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: "تم حذف المستخدم بنجاح",
  });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  const allowedRoles = ["user", "admin", "disabled"];
  if (!allowedRoles.includes(role)) {
    res.status(400);
    throw new Error("الدور غير صالح");
  }

  if (req.params.id === req.user._id.toString()) {
    res.status(400);
    throw new Error("لا يمكنك تغيير دورك الخاص");
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true },
  );

  if (!user) {
    res.status(404);
    throw new Error("المستخدم غير موجود");
  }

  res.status(200).json({
    success: true,
    message: `تم تحديث الدور إلى ${role} بنجاح`,
    user,
  });
});

export const disableUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    res.status(400);
    throw new Error("لا يمكنك تعطيل حسابك الخاص");
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role: "disabled" },
    { new: true },
  );

  if (!user) {
    res.status(404);
    throw new Error("المستخدم غير موجود");
  }

  res.status(200).json({
    success: true,
    message: "تم تعطيل الحساب بنجاح",
    user,
  });
});

export const enableUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role: "user" },
    { new: true },
  );

  if (!user) {
    res.status(404);
    throw new Error("المستخدم غير موجود");
  }

  res.status(200).json({
    success: true,
    message: "تم تفعيل الحساب بنجاح",
    user,
  });
});

// ============================================================
// ✏️ UPDATE USER — تحديث بيانات المستخدم
// ============================================================

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("المستخدم غير موجود");
  }

  user.firstName = req.body.firstName || user.firstName;
  user.lastName = req.body.lastName || user.lastName;
  user.address = req.body.address || user.address;
  user.city = req.body.city || user.city;
  user.phoneNo = req.body.phoneNo || user.phoneNo;

  if (req.file) {
    // ✅ ميزة الحماية الذكية التي أضفتها أنت: منع حذف الأفاتار الافتراضي
    if (
      user.profilePublicId &&
      user.profilePublicId !== "defaults/default-avatar"
    ) {
      await cloudinary.uploader.destroy(user.profilePublicId);
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "ecommerce/profiles",
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
          ],
          format: "webp",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(req.file.buffer);
    });

    user.profilePic = result.secure_url;
    user.profilePublicId = result.public_id;
  }

  const updatedUser = await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "تم تحديث الملف الشخصي بنجاح",
    user: {
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      isVerified: updatedUser.isVerified,
      profilePic: updatedUser.profilePic,
      address: updatedUser.address,
      city: updatedUser.city,
      phoneNo: updatedUser.phoneNo,
    },
  });
});

// ============================================================
// 🔑 UPDATE PASSWORD — تغيير كلمة المرور
// ============================================================

export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    res.status(400);
    throw new Error("جميع الحقول مطلوبة");
  }

  if (newPassword !== confirmPassword) {
    res.status(400);
    throw new Error("كلمتا المرور الجديدتان غير متطابقتان");
  }

  if (newPassword.length < 8) {
    res.status(400);
    throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
  }

  const user = await User.findById(req.user._id).select("+password");

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    res.status(400);
    throw new Error("كلمة المرور الحالية غير صحيحة");
  }

  const isSamePassword = await user.matchPassword(newPassword);
  if (isSamePassword) {
    res.status(400);
    throw new Error("كلمة المرور الجديدة يجب أن تكون مختلفة عن القديمة");
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: "تم تغيير كلمة المرور بنجاح",
  });
});

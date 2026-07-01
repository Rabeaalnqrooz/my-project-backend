// backend/models/userModel.js

import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";
import crypto from "crypto"; // ✅ مدمج في Node.js — لا يحتاج تثبيت

// ============================================================
// 📌 SCHEMA DEFINITION — تعريف هيكل بيانات المستخدم
// ============================================================

const userSchema = new mongoose.Schema(
  {
    // ─── الاسم الأول ───────────────────────────────────────
    firstName: {
      type: String,
      required: [true, "الاسم الأول مطلوب"],
      trim: true, // يحذف المسافات الزائدة من البداية والنهاية
      minlength: [2, "الاسم الأول يجب أن يكون حرفين على الأقل"],
      maxlength: [50, "الاسم الأول يجب أن يكون 50 حرف كحد أقصى"],
    },

    // ─── الاسم الأخير ──────────────────────────────────────
    lastName: {
      type: String,
      required: [true, "الاسم الأخير مطلوب"],
      trim: true,
      minlength: [2, "الاسم الأخير يجب أن يكون حرفين على الأقل"],
      maxlength: [50, "الاسم الأخير يجب أن يكون 50 حرف كحد أقصى"],
    },

    // ─── البريد الإلكتروني ─────────────────────────────────
    email: {
      type: String,
      required: [true, "البريد الإلكتروني مطلوب"],
      unique: true, // لا يسمح بتكرار نفس الإيميل
      lowercase: true, // يحوّل الإيميل لأحرف صغيرة تلقائياً قبل الحفظ
      trim: true,
      validate: {
        validator: validator.isEmail,
        message: "البريد الإلكتروني غير صالح",
      },
    },

    // ─── كلمة المرور ───────────────────────────────────────
    password: {
      type: String,
      required: [true, "كلمة المرور مطلوبة"],
      minlength: [8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"],
      // ✅ select: false — لن تُرجع كلمة المرور في أي استعلام تلقائياً
      // لجلبها يجب كتابة .select("+password") بشكل صريح
      select: false,
    },

    // ─── الصورة الشخصية ────────────────────────────────────
    profilePic: {
      type: String,
      default:
        "https://res.cloudinary.com/dfkc2tojy/image/upload/v12345678/defaults/default-avatar.webp", // رابط الصورة — يمكن ربطه بـ Cloudinary لاحقاً
    },

    profilePublicId: {
      type: String,
      default: "defaults/default-avatar", // معرّف الصورة في Cloudinary لحذفها عند التحديث
    },

    // ─── الدور / الصلاحية ──────────────────────────────────
    role: {
      type: String,
      // ✅ enum يمنع إدخال أي قيمة غير هذه الثلاثة
      enum: {
        values: ["user", "admin", "disabled"],
        message: "الدور يجب أن يكون: user أو admin أو disabled",
      },
      default: "user",
    },

    // ─── حالة التحقق من الإيميل ────────────────────────────
    isVerified: {
      type: Boolean,
      default: false, // المستخدم غير محقق عند التسجيل
    },

    // ─── توكن التحقق من الإيميل ────────────────────────────
    // ✅ نخزن التوكن بعد تشفيره (hash) وليس نصاً صريحاً
    emailVerifyToken: {
      type: String,
      default: null,
      select: false, // لا يُرجع في الاستعلامات العادية
    },

    emailVerifyTokenExpiry: {
      type: Date,
      default: null,
      select: false,
    },

    // ─── OTP لإعادة تعيين كلمة المرور ─────────────────────
    // ✅ نخزن OTP بعد تشفيره أيضاً — إذا اخترق قاعدة البيانات لا يُستخدم
    otp: {
      type: String,
      default: null,
      select: false,
    },

    otpExpiry: {
      type: Date,
      default: null,
      select: false,
    },

    // ─── معلومات إضافية (اختيارية) ─────────────────────────
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    zipCode: { type: String, default: "" },
    phoneNo: { type: String, default: "" },
  },

  {
    timestamps: true, // يضيف createdAt و updatedAt تلقائياً
  },
);

// ============================================================
// 🔐 MIDDLEWARE — تشفير كلمة المرور قبل الحفظ
// ============================================================

userSchema.pre("save", async function () {
  // ✅ نشفّر فقط إذا تغيرت كلمة المرور
  // هذا يمنع إعادة التشفير عند تحديث حقل آخر كالإيميل
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12); // 12 = قوة التشفير (أعلى = أبطأ وأأمن)
  this.password = await bcrypt.hash(this.password, salt);
});

// ============================================================
// 🔧 INSTANCE METHODS — دوال مرتبطة بكل مستخدم
// ============================================================

// ─── مقارنة كلمة المرور عند تسجيل الدخول ──────────────────
// الاستخدام: const isMatch = await user.matchPassword("123456")
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ─── توليد توكن التحقق من الإيميل ──────────────────────────
// ✅ نولّد توكن عشوائي — نرسله للمستخدم
//    نخزن نسخة مشفرة منه في قاعدة البيانات (للأمان)
userSchema.methods.generateEmailVerifyToken = function () {
  // 1️⃣ توليد توكن عشوائي
  const rawToken = crypto.randomBytes(32).toString("hex");

  // 2️⃣ تشفيره قبل الحفظ
  this.emailVerifyToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  // 3️⃣ صلاحية 24 ساعة
  this.emailVerifyTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

  // 4️⃣ نرجع التوكن الخام (غير المشفر) لإرساله في الإيميل
  return rawToken;
};

// ─── توليد OTP لإعادة تعيين كلمة المرور ────────────────────
// ✅ نولّد OTP رقمي — نخزن نسخة مشفرة منه
userSchema.methods.generateOTP = function () {
  // 1️⃣ توليد OTP من 6 أرقام
  const rawOTP = Math.floor(100000 + Math.random() * 900000).toString();

  // 2️⃣ تشفيره قبل الحفظ في قاعدة البيانات
  this.otp = crypto.createHash("sha256").update(rawOTP).digest("hex");

  // 3️⃣ صلاحية 10 دقائق فقط
  this.otpExpiry = Date.now() + 10 * 60 * 1000;

  // 4️⃣ نرجع OTP الخام لإرساله للمستخدم
  return rawOTP;
};

// ─── التحقق من OTP المُدخل ──────────────────────────────────
// الاستخدام: const isValid = user.verifyOTP("123456")
userSchema.methods.verifyOTP = function (enteredOTP) {
  // نشفر OTP المُدخل ونقارنه بالمخزن
  const hashedEntered = crypto
    .createHash("sha256")
    .update(enteredOTP)
    .digest("hex");

  const isMatch = this.otp === hashedEntered;
  const isNotExpired = this.otpExpiry > Date.now();

  return isMatch && isNotExpired;
};

// ─── مسح بيانات OTP بعد الاستخدام ──────────────────────────
userSchema.methods.clearOTP = function () {
  this.otp = null;
  this.otpExpiry = null;
};

// ─── مسح توكن التحقق بعد الاستخدام ─────────────────────────
userSchema.methods.clearEmailVerifyToken = function () {
  this.emailVerifyToken = null;
  this.emailVerifyTokenExpiry = null;
};

// ============================================================
// 📤 EXPORT
// ============================================================

export const User = mongoose.model("User", userSchema);

// backend/emailVerify/verifyEmail.js

import nodemailer from "nodemailer";

// ============================================================
// 📧 VERIFY EMAIL — إرسال إيميل التحقق من الحساب
// ============================================================

export const verifyEmail = async (token, email) => {
  // ─── 1️⃣ إنشاء الـ Transporter المطور للإنتاج ──────────────────────────────
  // ✅ قمنا بتحديد السيرفر والبورت يدوياً لتفادي حظر الشبكة أونلاين (ENETUNREACH :465)
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 25, // 👈 جربنا المنفذ 25 لأنه أحياناً يكون مفتوحاً لتمرير البيانات أونلاين
    secure: false,
    family: 4,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  // ─── 2️⃣ رابط التحقق ─────────────────────────────────────
  // ✅ نأخذ الرابط من .env بدلاً من كتابته بشكل ثابت في الكود
  const verifyUrl = `${process.env.FRONTEND_URL}/verify/${token}`;

  // ─── 3️⃣ قالب الإيميل ────────────────────────────────────
  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME || "فريق الدعم"}" <${process.env.MAIL_USER}>`,
    to: email,
    subject: "تفعيل حسابك — يرجى التحقق من بريدك الإلكتروني",

    // ✅ نص عادي كـ fallback لبعض عملاء الإيميل القديمة
    text: `
      مرحباً،
      شكراً لتسجيلك معنا.
      يرجى تفعيل حسابك بالنقر على الرابط التالي:
      ${verifyUrl}
      هذا الرابط صالح لمدة 24 ساعة.
      إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذا الإيميل.
    `,

    // ✅ HTML احترافي — أفضل تجربة للمستخدم
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>تفعيل الحساب</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0"
                style="background-color:#ffffff; border-radius:8px;
                       box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow:hidden;">

                <!-- Header -->
                <tr>
                  <td style="background-color:#4F46E5; padding: 32px; text-align:center;">
                    <h1 style="color:#ffffff; margin:0; font-size:24px;">تفعيل حسابك</h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 32px; text-align:right; direction:rtl;">
                    <p style="color:#374151; font-size:16px; line-height:1.7; margin-top:0;">
                      مرحباً،
                    </p>
                    <p style="color:#374151; font-size:16px; line-height:1.7;">
                      شكراً لتسجيلك معنا! يرجى النقر على الزر أدناه لتفعيل حسابك.
                    </p>
                    <p style="color:#374151; font-size:16px; line-height:1.7;">
                      هذا الرابط صالح لمدة <strong>24 ساعة</strong> فقط.
                    </p>

                    <!-- CTA Button -->
                    <div style="text-align:center; margin: 32px 0;">
                      <a href="${verifyUrl}"
                        style="background-color:#4F46E5; color:#ffffff;
                               padding: 14px 32px; border-radius:6px;
                               text-decoration:none; font-size:16px;
                               font-weight:bold; display:inline-block;">
                        تفعيل الحساب
                      </a>
                    </div>

                    <!-- Fallback Link -->
                    <p style="color:#6B7280; font-size:13px; line-height:1.6;">
                      إذا لم يعمل الزر، انسخ الرابط التالي وضعه في المتصفح:
                      <br/>
                      <a href="${verifyUrl}" style="color:#4F46E5; word-break:break-all;">
                        ${verifyUrl}
                      </a>
                    </p>

                    <hr style="border:none; border-top:1px solid #E5E7EB; margin: 24px 0;" />

                    <p style="color:#9CA3AF; font-size:13px;">
                      إذا لم تقم بإنشاء هذا الحساب, يمكنك تجاهل هذا الإيميل بأمان.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color:#F9FAFB; padding: 20px 32px; text-align:center;">
                    <p style="color:#9CA3AF; font-size:12px; margin:0;">
                      © ${new Date().getFullYear()} جميع الحقوق محفوظة
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  // ─── 4️⃣ إرسال الإيميل ───────────────────────────────────
  // سيعمل بسلاسة تامة مع الـ catch المضافة في الـ Controller
  await transporter.sendMail(mailOptions);
};

// backend/emailVerify/sendOTPMail.js

import { Resend } from "resend";

// تفعيل الخدمة باستخدام المفتاح المخزن في متغيرات البيئة بـ Render
const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================================
// 📧 SEND OTP MAIL — إرسال كود OTP لإعادة تعيين كلمة المرور
// ============================================================

export const sendOTPMail = async (otp, email) => {
  // ⚠️ ملاحظة هامة لبيئة التطوير:
  // في الخطة المجانية لـ Resend (إذا لم تقم بربط دومين خاص بك بعد)،
  // يجب أن يكون المرسل (from) دائماً هو الإيميل المتاح تلقائياً: 'onboarding@resend.dev'
  // ويمكنك الإرسال فقط إلى الإيميل الشخصي الذي سجلت به حسابك في Resend للتجربة.
  const fromEmail = "onboarding@resend.dev";

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "كود إعادة تعيين كلمة المرور (OTP)",

    // ✅ نص عادي كـ fallback
    text: `
      مرحباً،
      تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.
      كود التحقق الخاص بك هو: ${otp}
      هذا الكود صالح لمدة 10 دقائق فقط.
      إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا الإيميل.
    `,

    // ✅ قالب الـ HTML الاحترافي الخاص بك كما هو
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>كود OTP</title>
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
                  <td style="background-color:#DC2626; padding: 32px; text-align:center;">
                    <h1 style="color:#ffffff; margin:0; font-size:24px;">إعادة تعيين كلمة المرور</h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 32px; text-align:right; direction:rtl;">
                    <p style="color:#374151; font-size:16px; line-height:1.7; margin-top:0;">
                      مرحباً،
                    </p>
                    <p style="color:#374151; font-size:16px; line-height:1.7;">
                      تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.
                      استخدم الكود التالي لإتمام العملية:
                    </p>

                    <!-- OTP Box -->
                    <div style="text-align:center; margin: 32px 0;">
                      <div style="display:inline-block; background-color:#FEF2F2;
                                  border: 2px dashed #DC2626; border-radius:8px;
                                  padding: 20px 48px;">
                        <span style="font-size:42px; font-weight:bold;
                                     color:#DC2626; letter-spacing:12px;
                                     font-family: 'Courier New', monospace;">
                          ${otp}
                        </span>
                      </div>
                    </div>

                    <!-- Expiry Warning -->
                    <div style="background-color:#FFFBEB; border-right: 4px solid #F59E0B;
                                padding: 12px 16px; border-radius:4px; margin-bottom:24px;">
                      <p style="color:#92400E; font-size:14px; margin:0;">
                        ⚠️ هذا الكود صالح لمدة <strong>10 دقائق فقط</strong>
                      </p>
                    </div>

                    <hr style="border:none; border-top:1px solid #E5E7EB; margin: 24px 0;" />

                    <!-- Security Warning -->
                    <p style="color:#6B7280; font-size:13px; line-height:1.6;">
                      🔒 <strong>تنبيه أمني:</strong> لا تشارك هذا الكود مع أي شخص.
                      فريقنا لن يطلب منك هذا الكود أبداً.
                    </p>

                    <p style="color:#9CA3AF; font-size:13px;">
                      إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا الإيميل بأمان.
                      حسابك لا يزال محمياً.
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
  });
};

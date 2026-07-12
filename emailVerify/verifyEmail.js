// backend/emailVerify/verifyEmail.js

import { Resend } from "resend";

// تفعيل الخدمة باستخدام المفتاح من متغيرات البيئة
const resend = new Resend(process.env.RESEND_API_KEY);

export const verifyEmail = async (token, email) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify/${token}`;

  try {
    await resend.emails.send({
      // ⚠️ ملاحظة: في الخطة المجانية لـ Resend بدون دومين خاص، يجب أن يكون المرسل دائماً 'onboarding@resend.dev'
      from: "onboarding@resend.dev",
      to: email, // يمكنك الإرسال لإيميلك الشخصي المرتبط بحساب Resend للتجربة
      subject: "تفعيل حسابك — يرجى التحقق من بريدك الإلكتروني",
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head><meta charset="UTF-8" /></head>
        <body style="font-family: Arial, sans-serif; text-align: right; direction: rtl;">
          <h2>مرحباً بك!</h2>
          <p>شكراً لتسجيلك معنا. يرجى الضغط على الرابط أدناه لتفعيل الحساب:</p>
          <a href="${verifyUrl}" style="background-color:#4F46E5; color:#white; padding:12px 24px; text-decoration:none; border-radius:5px; display:inline-block;">تفعيل الحساب</a>
          <p>أو انسخ الرابط التالي: ${verifyUrl}</p>
        </body>
        </html>
      `,
    });
    console.log("✅ تم إرسال الإيميل بنجاح عبر Resend!");
  } catch (error) {
    console.error("❌ فشل إرسال الإيميل عبر Resend:", error);
  }
};

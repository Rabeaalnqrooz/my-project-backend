// backend/emailVerify/verifyEmail.js

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const verifyEmail = async (token, email) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify/${token}`;

  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "تفعيل حسابك — يرجى التحقق من بريدك الإلكتروني",
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head><meta charset="UTF-8" /></head>
        <body style="font-family: Arial, sans-serif; text-align: right; direction: rtl; padding: 20px; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <h2 style="color: #1f2937; margin-bottom: 20px;">مرحباً بك!</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">شكراً لتسجيلك معنا. يرجى الضغط على الرابط أدناه لتفعيل الحساب:</p>
            
            <div style="text-align: right; margin: 25px 0;">
              <!-- ✅ تم إصلاح اللون هنا ليصبح color: #ffffff وتعديل التنسيق ليظهر بشكل احترافي -->
              <a href="${verifyUrl}" style="background-color: #4F46E5; color: #ffffff !important; padding: 12px 30px; text-decoration: none !important; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                تفعيل الحساب
              </a>
            </div>
            
            <p style="color: #9ca3af; font-size: 14px; margin-top: 30px;">أو انسخ الرابط التالي وضعه في متصفحك مباشرة:</p>
            <a href="${verifyUrl}" style="color: #4F46E5; word-break: break-all; font-size: 14px;">${verifyUrl}</a>
          </div>
        </body>
        </html>
      `,
    });
    console.log("✅ تم إرسال الإيميل بنجاح عبر Resend!");
  } catch (error) {
    console.error("❌ فشل إرسال الإيميل عبر Resend:", error);
  }
};

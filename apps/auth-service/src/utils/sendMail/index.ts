import nodemailer from "nodemailer";
import dotenv from "dotenv";
import ejs from "ejs";
import path from "path";

dotenv.config();

// Auth
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  service: process.env.SMTP_SERVICE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Render an EJS email template
const renderEmailTemplate = async (
  templateName: string,
  data: Record<string, any>
): Promise<string> => {
  const templatePath = path.join(
    process.cwd(),
    "apps",
    "auth-service",
    "src",
    "utils",
    "email-templates",
    `${templateName}.ejs`
  );

  return ejs.renderFile(templatePath, data);
};

// Send an email using nodemailer
export const sendEmail = async (
  to: string,
  subject: string,
  templateName: string,
  data: Record<string, any>
) => {
  try {
    const html = await renderEmailTemplate(templateName, data);

    // 🔧 Fix: nom d'expéditeur explicite + chevrons fermés correctement
    // Améliore la délivrabilité (évite les filtres anti-spam pour from mal formé)
    const fromName = process.env.SMTP_FROM_NAME || "Yamba";
    const fromAddress = process.env.SMTP_USER;

    await transporter.sendMail({
      from: `${fromName} <${fromAddress}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.log("Error sending email", error);
    return false;
  }
};

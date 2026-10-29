
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail({
  to,
  subject,
  text,
}: EmailMessage): Promise<void> {
  // Mode développement : affiche l'email dans le terminal
  if (env.mailTransport === "console") {
    console.log("\n===== EMAIL SOLSTICEBANK =====");
    console.log("Destinataire :", to);
    console.log("Sujet :", subject);
    console.log("Message :", text);
    console.log("=============================\n");
    return;
  }

  // Mode SMTP : envoi réel de l'email
  const smtp = env.smtp;

  if (!smtp) {
    throw new Error("Configuration SMTP manquante.");
  }

  const from = smtp.from;

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  const info = await transporter.sendMail({
  from,
  to,
  subject,
  text,
});

if (!env.isProduction) {
  console.log("Email accepté par le serveur SMTP Alwaysdata");
  console.log("Message ID :", info.messageId);
  console.log("Destinataires acceptés :", info.accepted);
  console.log("Destinataires refusés :", info.rejected);
  console.log("Réponse SMTP :", info.response);
} 
}

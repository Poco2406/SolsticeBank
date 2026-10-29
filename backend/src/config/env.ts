// backend/src/config/env.ts
import 'dotenv/config';

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Variable d'environnement manquante : ${name}`);
    }
    return value;
}

const mailTransport = process.env.MAIL_TRANSPORT ?? 'console';
if (mailTransport !== 'console' && mailTransport !== 'smtp') {
    throw new Error('MAIL_TRANSPORT doit valoir "console" ou "smtp"');
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT doit être un entier positif');
}

export const env = {
    port,
    isProduction: process.env.NODE_ENV === 'production',
    frontendUrl: required('FRONTEND_URL'),
    mongodbUri: required('MONGODB_URI'),
    mongodbTestUri: required('MONGODB_TEST_URI'),
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: required('JWT_EXPIRES_IN'),
    mailTransport,
    smtp: mailTransport === 'smtp'
        ? {
            host: required('SMTP_HOST'),
            port: Number(required('SMTP_PORT')),
            user: required('SMTP_USER'),
            pass: required('SMTP_PASS'),
            from: required('SMTP_FROM'),
        }
        : null,
} as const;

import 'dotenv/config';

import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function askHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Ce script doit être lancé dans un terminal interactif.');
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };

    const onData = (data: Buffer) => {
      for (const char of data.toString('utf8')) {
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Opération annulée.'));
          return;
        }

        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(value);
          return;
        }

        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }

        if (char >= ' ') {
          value += char;
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const databaseUrl = process.env.DATABASE_URL;

  if (!email || !databaseUrl) {
    throw new Error('ADMIN_EMAIL ou DATABASE_URL manquant dans .env');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('L’adresse ADMIN_EMAIL est invalide.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
    }),
  });

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('Un compte existe déjà avec cette adresse.');
    }

    const password = await askHidden('Mot de passe administrateur : ');

    if (password.length < 12 || password.length > 128) {
      throw new Error('Le mot de passe doit contenir entre 12 et 128 caractères.');
    }

    const confirmation = await askHidden('Confirmer le mot de passe : ');

    if (password !== confirmation) {
      throw new Error('Les mots de passe ne correspondent pas.');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    await prisma.user.create({
      data: {
        email,
        password: passwordHash,
      },
    });

    console.log(`Compte administrateur créé pour ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Erreur :',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});

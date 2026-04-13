import bcrypt from 'bcryptjs';
import { masterDb } from '../../../database/master';

export class AuthService {
  async validateLogin(email: string, pass: string) {
    const user = await masterDb.user.findUnique({
      where: { email },
      include: { 
        company: {
          include: {
            // Traz a assinatura ativa para injetar os limites do plano no Token
            subscriptions: {
              include: { plan: true },
              orderBy: { created_at: 'desc' },
              take: 1
            }
          }
        } 
      }
    });

    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(pass, user.password_hash);
    if (!isPasswordValid) return null;

    if (!user.company.is_active) throw new Error('Esta conta empresarial está suspensa.');

    return user;
  }
}
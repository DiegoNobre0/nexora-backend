import { masterDb } from "src/database/master";
import bcrypt from 'bcryptjs';

export class UsersService {
  async listAll() {
    return await masterDb.user.findMany({
      include: { company: true }
    });
  }

  async findByCompany(companyId: string) {
    return await masterDb.user.findMany({
      where: { company_id: companyId },
      select: { id: true, name: true, email: true, role: true, created_at: true }
    });
  }


  async create(companyId: string, data: any) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    return await masterDb.user.create({
      data: {
        company_id: companyId,
        name: data.name,
        email: data.email,
        password_hash: passwordHash,
        role: data.role || 'OWNER'
      }
    });
  }

  async update(id: string, data: any) {
    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }
    return await masterDb.user.update({
      where: { id },
      data
    });
  }
}
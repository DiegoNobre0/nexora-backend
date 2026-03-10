export class EmployeesService {
    async create(db, data) {
        return await db.employee.create({
            data: {
                name: data.name,
                phone: data.phone,
                is_active: true
            }
        });
    }
    async listAll(db) {
        return await db.employee.findMany({
            where: { is_active: true },
            include: { services: true } // Já traz os serviços que ele faz
        });
    }
    async findById(db, id) {
        return await db.employee.findUnique({
            where: { id },
            include: { services: true }
        });
    }
    async update(db, id, data) {
        return await db.employee.update({
            where: { id },
            data
        });
    }
    async delete(db, id) {
        // Aqui fazemos o Soft Delete para manter a integridade dos dados
        return await db.employee.update({
            where: { id },
            data: { is_active: false }
        });
    }
}

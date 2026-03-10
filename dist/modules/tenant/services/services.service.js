export class ServicesService {
    async create(db, data) {
        return await db.service.create({
            data: {
                name: data.name,
                description: data.description,
                price: data.price,
                duration_minutes: data.duration_minutes,
                is_active: true
            }
        });
    }
    async listAll(db) {
        return await db.service.findMany({
            where: { is_active: true },
            orderBy: { name: 'asc' }
        });
    }
    async findById(db, id) {
        return await db.service.findUnique({
            where: { id }
        });
    }
    async update(db, id, data) {
        return await db.service.update({
            where: { id },
            data
        });
    }
    async delete(db, id) {
        return await db.service.update({
            where: { id },
            data: { is_active: false }
        });
    }
}

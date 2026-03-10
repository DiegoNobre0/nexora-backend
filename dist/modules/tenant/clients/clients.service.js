export class ClientsService {
    async create(db, data) {
        return await db.client.create({
            data: {
                name: data.name,
                phone: data.phone,
                birth_date: data.birth_date ? new Date(data.birth_date) : null,
                notes: data.notes,
            },
        });
    }
    async listAll(db) {
        return await db.client.findMany({
            orderBy: { name: 'asc' },
        });
    }
    async findById(db, id) {
        return await db.client.findUnique({
            where: { id },
        });
    }
    async update(db, id, data) {
        return await db.client.update({
            where: { id },
            data: {
                ...data,
                birth_date: data.birth_date ? new Date(data.birth_date) : undefined,
            },
        });
    }
    async delete(db, id) {
        return await db.client.delete({
            where: { id },
        });
    }
}

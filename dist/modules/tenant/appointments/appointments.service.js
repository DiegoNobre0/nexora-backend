export class AppointmentsService {
    async create(db, data) {
        const { employee_id, start_time, end_time } = data;
        // 1. Validar se o horário de término é depois do início
        if (new Date(start_time) >= new Date(end_time)) {
            throw new Error('O horário de término deve ser após o início.');
        }
        // 2. REGRA DE OURO: Verificar conflito de horário para o mesmo profissional
        // Procuramos qualquer agendamento que se sobreponha ao período desejado
        const conflict = await db.appointment.findFirst({
            where: {
                employee_id,
                status: { in: ['PENDING', 'CONFIRMED'] },
                OR: [
                    {
                        // Caso 1: O novo agendamento começa dentro de um existente
                        start_time: { lte: new Date(start_time) },
                        end_time: { gt: new Date(start_time) },
                    },
                    {
                        // Caso 2: O novo agendamento termina dentro de um existente
                        start_time: { lt: new Date(end_time) },
                        end_time: { gte: new Date(end_time) },
                    },
                ],
            },
        });
        if (conflict) {
            throw new Error('Este profissional já possui um agendamento neste horário.');
        }
        return await db.appointment.create({
            data: {
                client_id: data.client_id,
                employee_id: data.employee_id,
                service_id: data.service_id,
                start_time: new Date(start_time),
                end_time: new Date(end_time),
                notes: data.notes,
                status: 'PENDING',
            },
        });
    }
    async list(db, date) {
        return await db.appointment.findMany({
            where: date ? {
                start_time: {
                    gte: new Date(`${date}T00:00:00Z`),
                    lte: new Date(`${date}T23:59:59Z`),
                }
            } : {},
            include: {
                client: { select: { name: true, phone: true } },
                employee: { select: { name: true } },
                service: { select: { name: true, price: true } },
            },
            orderBy: { start_time: 'asc' },
        });
    }
    async updateStatus(db, id, status) {
        return await db.appointment.update({
            where: { id },
            data: { status }
        });
    }
}

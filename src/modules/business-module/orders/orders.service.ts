import { PrismaClient as BusinessClient } from '@prisma/business-client';
import { 
  startOfDay, 
  endOfDay, 
  addMinutes, 
  format, 
  isBefore, 
  isAfter, 
  parseISO,
  setHours,
  setMinutes,
  startOfMonth,
  endOfMonth
} from 'date-fns';

export class OrderService {
  async create(dbBusiness: BusinessClient, data: any) {
    const { employee_id, start_time, end_time } = data;

    // 1. Validar se o horário de término é depois do início
    if (new Date(start_time) >= new Date(end_time)) {
      throw new Error('O horário de término deve ser após o início.');
    }

    // 2. REGRA DE OURO: Verificar conflito de horário para o mesmo profissional
    // Procuramos qualquer agendamento que se sobreponha ao período desejado
    const conflict = await dbBusiness.calendar.findFirst({
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

    return await  dbBusiness.calendar.create({
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

async list(dbBusiness: BusinessClient, filters: { date?: string; month?: string }) {
    let whereClause = {};

    if (filters.date) {
      // Filtra por um dia específico
      const day = new Date(filters.date);
      whereClause = {
        start_time: { gte: startOfDay(day), lte: endOfDay(day) }
      };
    } else if (filters.month) {
      // Filtra pelo mês inteiro (Ideal para o Calendário do Angular)
      const monthDate = new Date(filters.month);
      whereClause = {
        start_time: { gte: startOfMonth(monthDate), lte: endOfMonth(monthDate) }
      };
    }

    return await dbBusiness.calendar.findMany({
      where: whereClause,
      include: {
        client: { select: { name: true } },
        employee: { select: { name: true } },
        service: { select: { name: true, duration_minutes: true } },
      },
      orderBy: { start_time: 'asc' },
    });
  }

  async updateStatus(dbBusiness: BusinessClient, id: string, status: any) {
    return await dbBusiness.calendar.update({
      where: { id },
      data: { status }
    });
  }


  async getAvailability(dbBusiness: BusinessClient, employee_id: string, date: string) {
    // 1. Definir o horário de funcionamento (Ex: 08:00 às 18:00)
    // No futuro, isso pode vir do cadastro do profissional ou da empresa
    const workStartHour = 8;
    const workEndHour = 18;
    const slotInterval = 30; // 30 minutos por slot

    const targetDate = parseISO(date);
    
    // 2. Buscar agendamentos existentes do profissional no dia
    const existingAppointments = await  dbBusiness.calendar.findMany({
      where: {
        employee_id,
        start_time: { gte: startOfDay(targetDate), lte: endOfDay(targetDate) },
        status: { in: ['PENDING', 'CONFIRMED'] }
      },
      select: { start_time: true, end_time: true }
    });

    // 3. Gerar todos os slots possíveis do dia
    const availableSlots: string[] = [];
    let currentSlot = setMinutes(setHours(targetDate, workStartHour), 0);
    const endWorkTime = setMinutes(setHours(targetDate, workEndHour), 0);

    while (isBefore(currentSlot, endWorkTime)) {
      const slotStart = currentSlot;
      const slotEnd = addMinutes(currentSlot, slotInterval);

      // 4. Verificar se o slot conflita com algum agendamento
      const isBusy = existingAppointments.some(appointment => {
        const appStart = new Date(appointment.start_time);
        const appEnd = new Date(appointment.end_time);

        // O slot está ocupado se ele começa antes do fim de um agendamento 
        // E termina depois do início de um agendamento
        return isBefore(slotStart, appEnd) && isAfter(slotEnd, appStart);
      });

      if (!isBusy) {
        availableSlots.push(format(slotStart, 'HH:mm'));
      }

      currentSlot = addMinutes(currentSlot, slotInterval);
    }

    return availableSlots;
  }
}
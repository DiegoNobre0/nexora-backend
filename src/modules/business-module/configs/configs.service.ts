import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError } from '../../../shared/errors/AppError';
import type { UpdateConfigInput, OperatingHours } from './configs.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Configs
//
// Gerencia as configurações globais da empresa (horários, IA, Meta).
// Como cada tenant tem seu DB, a tabela Config possui apenas 1 registro.
// ─────────────────────────────────────────────────────────────

export class ConfigsService {
  constructor(private readonly db: BusinessClient) {}

  // ─── Buscar Configuração Única ─────────────────────────────
  async getConfig() {
    const config = await this.db.config.findFirst();
    if (!config) {
      throw new NotFoundError('Configuração da empresa');
    }
    return config;
  }

  // ─── Atualizar Configuração ────────────────────────────────
  async updateConfig(input: UpdateConfigInput) {
    const config = await this.getConfig();

    return this.db.config.update({
      where: { id: config.id },
      data: {
        ...input,
        // O Prisma exige conversão explícita para JSON quando o campo no schema é Json
        ...(input.operating_hours && { operating_hours: input.operating_hours as any }),
        ...(input.holiday_dates   && { holiday_dates:   input.holiday_dates as any }),
      },
    });
  }

  // ─── Obter Mensagem de Fora de Horário ─────────────────────
  async getOutOfHoursMessage(): Promise<string> {
    const config = await this.getConfig();
    return config.out_of_hours_message || 'No momento estamos fechados. Deixe sua mensagem e retornaremos assim que abrirmos!';
  }

  // ─── Verificar se a loja está aberta AGORA ─────────────────
  // Motor essencial que será usado pelo Bot de WhatsApp
  async isWithinOperatingHours(): Promise<boolean> {
    const config = await this.getConfig();

    // Se o dono desativou a resposta automática geral, podemos considerar 
    // regras customizadas, mas por padrão olhamos os horários.
    if (!config.operating_hours) return true; // Fail-safe: se não tem horário, assume aberto

    const hours = config.operating_hours as unknown as OperatingHours;
    const holidays = (config.holiday_dates as string[]) || [];

    // Pegar data e hora exata no fuso de São Paulo (evita erro de servidor em UTC)
    const now = new Date();
    const brazilDateString = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const brazilNow = new Date(brazilDateString);

    // 1. Verificar Feriados (formato YYYY-MM-DD)
    const todayStr = brazilNow.toISOString().split('T')[0];
    if (holidays.includes(todayStr)) {
      return false; // É feriado, está fechado
    }

    // 2. Mapear o dia da semana atual (0 = Sunday, 1 = Monday...)
    const daysMap: (keyof OperatingHours)[] = [
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
    ];
    const todayKey = daysMap[brazilNow.getDay()];
    const todayConfig = hours[todayKey];

    // 3. Verificar se o dia de hoje está ativo
    if (!todayConfig || !todayConfig.active) {
      return false;
    }

    // 4. Comparar os horários HH:mm
    const currentHour = String(brazilNow.getHours()).padStart(2, '0');
    const currentMin  = String(brazilNow.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHour}:${currentMin}`;

    // Lógica string segura: "08:30" >= "08:00" e "08:30" <= "18:00"
    const isOpen = currentTime >= todayConfig.open && currentTime <= todayConfig.close;

    return isOpen;
  }

  // ─── Obter Status em Tempo Real (Para o Front) ─────────────
  async getCurrentStatus() {
    const is_open = await this.isWithinOperatingHours();
    const message = is_open ? null : await this.getOutOfHoursMessage();
    
    return {
      is_open,
      out_of_hours_message: message,
      checked_at: new Date().toISOString()
    };
  }
}
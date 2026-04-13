import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import type { CreateDeliveryZoneInput, UpdateDeliveryZoneInput, ListDeliveryZonesInput, CalculateDeliveryInput } from './delivery.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Delivery
//
// Gerencia as zonas de entrega e o motor de cálculo de frete.
// ─────────────────────────────────────────────────────────────

export class DeliveryService {
  constructor(private readonly db: BusinessClient) {}

  // ─── Listar com filtros e paginação ───────────────────────
  async list(input: ListDeliveryZonesInput) {
    const { type, is_active, page, limit } = input;
    const skip = (page - 1) * limit;

    const where = {
      ...(type      && { type }),
      ...(is_active !== undefined && { is_active }),
    };

    const [zones, total] = await Promise.all([
      this.db.deliveryZone.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fee: 'asc' }, // Ordena da taxa mais barata para a mais cara
      }),
      this.db.deliveryZone.count({ where }),
    ]);

    return {
      data: zones,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next:    page * limit < total,
        has_prev:    page > 1,
      },
    };
  }

  // ─── Buscar por ID ─────────────────────────────────────────
  async findById(id: string) {
    const zone = await this.db.deliveryZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundError('Zona de entrega');
    return zone;
  }

  // ─── Criar ────────────────────────────────────────────────
  async create(input: CreateDeliveryZoneInput) {
    // Normaliza CEP ou Bairro para facilitar a busca depois
    const normalizedValue = this.normalizeZoneValue(input.type, input.value);
    
    return this.db.deliveryZone.create({ 
      data: { ...input, value: normalizedValue } 
    });
  }

  // ─── Atualizar ────────────────────────────────────────────
  async update(id: string, input: UpdateDeliveryZoneInput) {
    const current = await this.findById(id);
    
    const typeToUse = input.type ?? current.type;
    const valueToUse = input.value ?? current.value;
    const normalizedValue = input.value ? this.normalizeZoneValue(typeToUse, valueToUse) : undefined;

    return this.db.deliveryZone.update({ 
      where: { id }, 
      data: { ...input, ...(normalizedValue && { value: normalizedValue }) } 
    });
  }

  // ─── Deletar ──────────────────────────────────────────────
  async delete(id: string) {
    const zone = await this.findById(id);
    await this.db.deliveryZone.delete({ where: { id } });
    return { message: `Zona de entrega "${zone.name}" deletada com sucesso.` };
  }

  // ─── Motor de Cálculo de Frete ─────────────────────────────
  async calculateFee(input: CalculateDeliveryInput) {
    const { order_amount, distance_km, district, zip_code } = input;

    // Busca todas as zonas ativas para processar a regra correta
    const activeZones = await this.db.deliveryZone.findMany({
      where: { is_active: true },
    });

    if (activeZones.length === 0) {
      throw new ValidationError('Nenhuma zona de entrega configurada ou ativa no sistema.');
    }

    let matchedZone = null;

    // 1. Tenta casar por Raio (KM) primeiro (se fornecido)
    if (distance_km !== undefined) {
      const radiusZones = activeZones
        .filter(z => z.type === 'RADIUS_KM')
        .sort((a, b) => Number(a.value) - Number(b.value)); // Ordena do menor raio para o maior

      // Encontra a primeira zona cujo raio limite é maior ou igual à distância
      matchedZone = radiusZones.find(z => distance_km <= Number(z.value));
    }

    // 2. Se não achou por KM e tem Bairro, tenta por Bairro (exato ou parcial)
    if (!matchedZone && district) {
      const normalizedDistrict = this.normalizeZoneValue('DISTRICT', district);
      matchedZone = activeZones.find(z => 
        z.type === 'DISTRICT' && z.value === normalizedDistrict
      );
    }

    // 3. Se não achou e tem CEP, tenta por CEP
    if (!matchedZone && zip_code) {
      const normalizedZip = this.normalizeZoneValue('ZIP_CODE', zip_code);
      matchedZone = activeZones.find(z => 
        z.type === 'ZIP_CODE' && z.value.startsWith(normalizedZip) // Permite faixa parcial de CEP
      );
    }

    // 4. Se não achou nada, tenta a taxa Fixa (Fallback padrão da loja)
    if (!matchedZone) {
      matchedZone = activeZones.find(z => z.type === 'FIXED');
    }

    // 5. Se não tem fallback e não achou zona, a loja não entrega ali
    if (!matchedZone) {
      throw new ValidationError('Infelizmente não entregamos neste endereço no momento.');
    }

    // ─── Aplicação das Regras da Zona Encontrada ───────────

    // Regra de Pedido Mínimo
    if (matchedZone.min_order && order_amount < Number(matchedZone.min_order)) {
      throw new ValidationError(
        `O valor mínimo para entrega em "${matchedZone.name}" é de R$ ${Number(matchedZone.min_order).toFixed(2)}.`
      );
    }

    // Regra de Frete Grátis
    let finalFee = Number(matchedZone.fee);
    let isFreeDelivery = false;

    if (matchedZone.free_above && order_amount >= Number(matchedZone.free_above)) {
      finalFee = 0;
      isFreeDelivery = true;
    }

    return {
      zone_id:        matchedZone.id,
      zone_name:      matchedZone.name,
      delivery_fee:   finalFee,
      is_free:        isFreeDelivery,
      free_above:     matchedZone.free_above ? Number(matchedZone.free_above) : null,
      message:        isFreeDelivery ? 'Frete Grátis alcançado!' : `Frete para ${matchedZone.name}.`,
    };
  }

  // ─── Métodos privados ──────────────────────────────────────

  /**
   * Normaliza os valores para facilitar a busca.
   * Ex: Remove pontuação do CEP e transforma bairro em minúsculo sem acento.
   */
  private normalizeZoneValue(type: string, value: string): string {
    if (type === 'ZIP_CODE') {
      return value.replace(/\D/g, ''); // Deixa só os números
    }
    if (type === 'DISTRICT') {
      return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .trim();
    }
    return value; // FIXED e RADIUS_KM passam reto
  }
}
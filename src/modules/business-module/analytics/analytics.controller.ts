import type { FastifyRequest, FastifyReply } from 'fastify';
import { AnalyticsService } from './analytics.service';
import { periodQuerySchema, forecastQuerySchema, exportQuerySchema } from './analytics.schema';

// ─────────────────────────────────────────────────────────────
// CONTROLLER — Analytics
// ─────────────────────────────────────────────────────────────

export class AnalyticsController {
  
  async getTopProducts(request: FastifyRequest, reply: FastifyReply) {
    const query = periodQuerySchema.parse(request.query);
    const service = new AnalyticsService(request.businessDb);
    const { startDate, endDate } = service.parseDates(query);
    return reply.send(await service.getTopSellingProducts(startDate, endDate));
  }

  async getRevenueChannel(request: FastifyRequest, reply: FastifyReply) {
    const query = periodQuerySchema.parse(request.query);
    const service = new AnalyticsService(request.businessDb);
    const { startDate, endDate } = service.parseDates(query);
    return reply.send(await service.getRevenueByChannel(startDate, endDate));
  }

  async getDemandForecast(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const query = forecastQuerySchema.parse(request.query);
    const service = new AnalyticsService(request.businessDb);
    return reply.send(await service.getDemandForecast(id, query.days));
  }

  async getBotFunnel(request: FastifyRequest, reply: FastifyReply) {
    const query = periodQuerySchema.parse(request.query);
    const service = new AnalyticsService(request.businessDb);
    const { startDate, endDate } = service.parseDates(query);
    
    const funnel = await service.getBotConversionFunnel(startDate, endDate);
    const resolution = await service.getAverageResolutionTime(startDate, endDate);
    
    return reply.send({ ...funnel, resolution_time: resolution });
  }

  async getLTV(request: FastifyRequest, reply: FastifyReply) {
    const { clientId } = request.params as { clientId: string };
    const service = new AnalyticsService(request.businessDb);
    return reply.send(await service.getCustomerLifetimeValue(clientId));
  }

  async getSimplifiedDRE(request: FastifyRequest, reply: FastifyReply) {
    const query = periodQuerySchema.parse(request.query);
    const service = new AnalyticsService(request.businessDb);
    const { startDate, endDate } = service.parseDates(query);
    return reply.send(await service.getSimplifiedDRE(startDate, endDate));
  }

  async getAccountsReceivable(request: FastifyRequest, reply: FastifyReply) {
    const service = new AnalyticsService(request.businessDb);
    return reply.send(await service.getAccountsReceivable());
  }

  async getCashFlow(request: FastifyRequest, reply: FastifyReply) {
    const query = periodQuerySchema.parse(request.query);
    const service = new AnalyticsService(request.businessDb);
    const { startDate, endDate } = service.parseDates(query);
    return reply.send(await service.getCashFlow(startDate, endDate));
  }

  // Rota genérica de exportação CSV para qualquer relatório de array (Ex: Recebíveis ou Produtos)
  async exportReceivablesCSV(request: FastifyRequest, reply: FastifyReply) {
    const service = new AnalyticsService(request.businessDb);
    const report = await service.getAccountsReceivable();
    const csv = service.generateCSV(report.data);
    
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="contas_receber.csv"')
      .send(csv);
  }
}
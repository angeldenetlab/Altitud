/**
 * Servicios que consume la UI. Cada uno habla con su Route Handler en
 * `/api/erp/*` y NUNCA con el ERP directamente.
 *
 * Al conectar Odoo esta capa no cambia: se mantiene el mismo contrato
 * `{ action, payload }` y solo se reimplementa el Route Handler.
 */
export { projectsService } from "./projectsService";
export { quotesService } from "./quotesService";
export { clientsService } from "./clientsService";
export { attendanceService } from "./attendanceService";
export { purchasesService } from "./purchasesService";
export { payrollService } from "./payrollService";
export { catalogsService } from "./catalogsService";
export { dashboardService } from "./dashboardService";
export { reportsService } from "./reportsService";
export { chatterService } from "./chatterService";

import { z } from 'zod';
export const trackingSchema=z.object({visit_id:z.uuid(),active_ms:z.number().int().min(0).max(86400000),sequence:z.number().int().min(0).max(2147483647),touched:z.array(z.string().min(1).max(80)).max(24),answered:z.array(z.string().min(1).max(80)).max(24)}).strict();
export type SurveyTracking=z.infer<typeof trackingSchema>;

import 'server-only';
import type { createClient } from './supabase/server';
export type ResponseTrends={timezone:string;from:string;through:string;total:number;daily:{day:string;responses:number}[];weekdays:{weekday:number;responses:number}[]};
export async function responseTrends(db:Awaited<ReturnType<typeof createClient>>,restaurant:string|null,employee:string|null,rating:number|null):Promise<ResponseTrends|null>{
 const {data,error}=await db.rpc('survey_response_trends',{p_restaurant_id:restaurant,p_employee_id:employee,p_rating:rating});
 if(error){if(['PGRST202','42883'].includes(error.code))return null;throw new Error('No pudimos cargar las gráficas de respuestas.');}
 return data as ResponseTrends;
}

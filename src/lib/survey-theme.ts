import { z } from 'zod';
export const hexColor=z.string().regex(/^#[0-9a-fA-F]{6}$/,'Elige un color hexadecimal válido.').transform(value=>value.toUpperCase());
export const surveyThemeSchema=z.object({backgroundColor:hexColor,backgroundImagePath:z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/,'La imagen no es válida.').nullable(),accentColor:hexColor}).strict();
export type SurveyTheme=z.infer<typeof surveyThemeSchema>;
export const DEFAULT_THEME:SurveyTheme={backgroundColor:'#FFFFFF',backgroundImagePath:null,accentColor:'#2563EB'};
export function normalizeTheme(value:unknown):SurveyTheme{const parsed=surveyThemeSchema.safeParse(value);return parsed.success?parsed.data:{...DEFAULT_THEME};}
export function backgroundUrl(path:string|null){return path?`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/survey-backgrounds/${path.split('/').map(encodeURIComponent).join('/')}`:null;}
function luminance(hex:string){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
export function themeTokens(theme:SurveyTheme){const luminanceValue=luminance(theme.accentColor),whiteContrast=1.05/(luminanceValue+.05),blackContrast=(luminanceValue+.05)/.05;return {'--survey-accent':theme.accentColor,'--survey-accent-text':whiteContrast>=blackContrast?'#FFFFFF':'#000000','--survey-focus':whiteContrast>=4.5?theme.accentColor:'#15171C'};}

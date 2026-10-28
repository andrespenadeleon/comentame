import type { SurveyTheme } from './survey-theme';
import type { Question } from './validation';
export const SOCIAL_NAMES={instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',youtube:'YouTube'} as const;
export type SocialPlatform=keyof typeof SOCIAL_NAMES;
export type SocialLinks=Partial<Record<SocialPlatform,string>>;
export type SurveyBranding={name:string;logo_path?:string|null;social_links?:SocialLinks;google_maps_url?:string|null};
export type PublishedSurvey={id:string;version:number;title:string;questions:Question[];published_at:string;theme?:SurveyTheme};
export type AnswerValue=string|string[];
export type Answers=Record<string,AnswerValue>;
export type PublicSurvey={restaurant_id:string;restaurant_name:string;employee_id:string;logo_path:string|null;social_links:SocialLinks;google_maps_url:string;survey_version_id:string;title:string;questions:Question[];theme?:SurveyTheme};
export function logoUrl(path?:string|null){return path?`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/restaurant-logos/${path.split('/').map(encodeURIComponent).join('/')}`:null;}

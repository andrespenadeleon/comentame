import type { QuestionResponsePage } from './question-responses-types';
export type QuestionGroup={restaurant_id:string;restaurant_name:string;version_id:string;version:number;scope_version_id:string|null;key:string;label:string;question_type:string;presentation:string|null;answered:number;version_count:number;distribution:{label:string;total:number}[];preview:QuestionResponsePage['rows']};
export type QuestionAnalytics={groups:QuestionGroup[];scope?:string};
export function questionAnalyticsScope(restaurant:string,version:string,period:string,employee?:string|null,rating?:string|number|null){const query=new URLSearchParams({restaurant,version,period});if(employee)query.set('employee',employee);if(rating)query.set('rating',String(rating));return query.toString();}

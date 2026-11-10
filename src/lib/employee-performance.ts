import type { EmployeePerformance } from './overview';
export const MINIMUM_REVIEWS=3;
export function serviceEmployee(role:string){
 const normalized=role.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\b(gerent\w*|administr\w*|encargad\w*|propietari\w*|duen\w*|manager|cocin\w*|chef|limpieza|mantenim\w*)\b/.test(normalized))return false;
 return /\b(meser[oa]s?|camarer[oa]s?|waiter|waitress|anfitrion[a]?|host|hostess|bartender|barista|garroter[oa]s?)\b/.test(normalized);
}
// Compare the underlying fractions, not averages rounded for display.
export function comparePerformance(a:EmployeePerformance,b:EmployeePerformance){
 const average=b.rating_sum*a.reviews-a.rating_sum*b.reviews;
 if(average)return average;
 const fiveStars=b.five_stars*a.reviews-a.five_stars*b.reviews;
 return fiveStars||b.reviews-a.reviews;
}
export function employeeRecognition(employees:EmployeePerformance[]){
 const eligible=employees.filter(employee=>serviceEmployee(employee.role)&&employee.reviews>=MINIMUM_REVIEWS).sort(comparePerformance);
 const ranked=eligible.map((employee,index)=>({employee,position:index+1}));
 for(let index=1;index<ranked.length;index++)if(comparePerformance(ranked[index-1].employee,ranked[index].employee)===0)ranked[index].position=ranked[index-1].position;
 const eligibleIds=new Set(eligible.map(employee=>employee.id));
 const remaining=employees.filter(employee=>!eligibleIds.has(employee.id)).sort((a,b)=>Number(serviceEmployee(b.role))-Number(serviceEmployee(a.role))||b.reviews-a.reviews||a.name.localeCompare(b.name,'es'));
 return {winners:eligible.length?eligible.filter(employee=>comparePerformance(employee,eligible[0])===0):[],people:[...ranked,...remaining.map(employee=>({employee,position:null}))].slice(0,3)};
}

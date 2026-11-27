import type {Opinion} from '@/lib/opinions';
const date=(value:string)=>new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Monterrey'}).format(new Date(value));
export function FeedbackRowContent({item,comment}:{item:Opinion;comment?:string|null}){return <>
   <div className="feedback-person"><h3>{item.guest_name}</h3>{item.rating>0?<div className={`feedback-rating ${item.rating<=2?'low-rating':''}`}><span className="opinion-stars" aria-label={`${item.rating} de 5 estrellas`}>{'★'.repeat(item.rating)}<span>{'★'.repeat(5-item.rating)}</span></span><span className="feedback-score" aria-hidden="true">{item.rating.toFixed(1)} / 5</span></div>:<p className="muted">Sin calificación</p>}<p className="feedback-waiter"><span>Atendió:</span> {item.employee_name}</p><p className="feedback-restaurant">{item.restaurant_name}</p></div>
   {comment&&<p className="feedback-comment">{comment}</p>}
   <div className="feedback-row-end"><time dateTime={item.submitted_at}>{date(item.submitted_at)}</time><span className="text-link">Ver opinión →</span></div>
 </>;}

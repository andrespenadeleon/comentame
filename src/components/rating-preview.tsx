'use client';
import { useState } from 'react';
export function RatingPreview({id}:{id:string}) {
  const [rating,setRating]=useState(0);
  return <div className="rating-preview" role="group" aria-label="Calificación de 1 a 5 estrellas">{[1,2,3,4,5].map(n=><button key={n} type="button" aria-label={`${n} ${n===1?'estrella':'estrellas'}`} aria-pressed={rating===n} className={n<=rating?'selected':''} onClick={()=>setRating(n)}>★</button>)}<span className="sr-only" id={id}>{rating?`${rating} de 5 estrellas`:'Sin calificación'}</span></div>;
}

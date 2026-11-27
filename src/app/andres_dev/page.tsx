import type {Metadata} from 'next';
import {LoadingPlayground} from './playground';
export const metadata:Metadata={title:'Andrés · Dev playground',robots:{index:false,follow:false}};
export default function AndresDev(){return <LoadingPlayground/>;}

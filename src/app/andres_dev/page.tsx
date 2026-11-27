import type {Metadata} from 'next';
import {DashboardDemo} from './dashboard-demo';
export const metadata:Metadata={title:'Andrés · Dev playground',robots:{index:false,follow:false}};
export default function AndresDev(){return <DashboardDemo/>;}

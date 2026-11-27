import type {Metadata} from 'next';
import {DashboardDemo} from './dashboard-demo';
export const metadata:Metadata={title:'Dashboard demo',robots:{index:false,follow:false}};
export default function DashboardDemoPage(){return <DashboardDemo/>;}

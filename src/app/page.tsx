import type {Metadata} from 'next';
import LandingPage,{landingMetadata} from './landing_v2/landing-page';
export const metadata:Metadata=landingMetadata;
export default function Home(){return <LandingPage/>;}

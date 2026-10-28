import { requirePortalAdmin } from '@/lib/portal-admin';
export default async function AdminLayout({children}:{children:React.ReactNode}){await requirePortalAdmin();return children;}

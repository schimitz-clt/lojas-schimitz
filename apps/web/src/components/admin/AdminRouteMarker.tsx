import type { AdminSectionId } from '@/lib/admin-sections';

/** Hidden route marker so each /admin/... page documents the active section. */
export function AdminRouteMarker({ section }: { section: AdminSectionId }) {
  return <span data-admin-route={section} hidden />;
}

import { can, type Permission } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/server";
import { NoAccess } from "./admin-shell";

/**
 * Server-side permission gate for an admin page. The layout already redirects
 * anonymous visitors to /login, so this only has to handle "signed in but the
 * wrong role".
 */
export async function Require({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !can(session.role, permission)) {
    return <NoAccess permission={permission} />;
  }
  return <>{children}</>;
}

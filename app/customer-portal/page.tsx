import { Suspense } from "react";
import CustomerPortalContent from "./CustomerPortalContent";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div>Načítavam...</div>}>
      <CustomerPortalContent />
    </Suspense>
  );
}
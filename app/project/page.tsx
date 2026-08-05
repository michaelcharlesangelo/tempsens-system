"use client";

import ProjectRecapSection from "@/app/components/ProjectRecapSection";

// Visible to every role via the sidebar - same recap as Project Manager's
// own page, minus PO Value/Budgeting/Cost (see canManage in
// ProjectRecapSection). Anyone can still log Progress/Report/Cost through
// the Status panel; only Project Manager's own page can edit/delete a
// progress entry or add Budgeting.
export default function ProjectPage() {
  return <ProjectRecapSection canManage={false} />;
}

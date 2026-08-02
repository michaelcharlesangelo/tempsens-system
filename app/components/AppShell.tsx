"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ROLE_STORAGE_KEY, ROLE_LINKS, DEFAULT_ROLE } from "@/lib/roles";

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "dashboard":
      return <svg {...common}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="12" width="8" height="9" rx="1.5" /><rect x="3" y="14" width="8" height="7" rx="1.5" /></svg>;
    case "history":
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
    case "box":
      return <svg {...common}><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" /><path d="M3.5 7.5 12 12l8.5-4.5" /><path d="M12 12v9" /></svg>;
    case "alert":
      return <svg {...common}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>;
    case "file":
      return <svg {...common}><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h6" /></svg>;
    case "send":
      return <svg {...common}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>;
    case "user":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" /></svg>;
    case "bell":
      return <svg {...common}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>;
    case "swap":
      return <svg {...common}><path d="M7 4 3 8l4 4" /><path d="M3 8h13" /><path d="M17 20l4-4-4-4" /><path d="M21 16H8" /></svg>;
    case "gear":
      return <svg {...common}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .35 1.9l.05.05a2 2 0 1 1-2.85 2.85l-.05-.05a1.7 1.7 0 0 0-1.9-.35 1.7 1.7 0 0 0-1 1.55V19.5a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.9.35l-.05.05a2 2 0 1 1-2.85-2.85l.05-.05a1.7 1.7 0 0 0 .35-1.9 1.7 1.7 0 0 0-1.55-1H4.5a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.35-1.9l-.05-.05a2 2 0 1 1 2.85-2.85l.05.05a1.7 1.7 0 0 0 1.9.35H10.5a1.7 1.7 0 0 0 1-1.55V4.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.9-.35l.05-.05a2 2 0 1 1 2.85 2.85l-.05.05a1.7 1.7 0 0 0-.35 1.9V10.5a1.7 1.7 0 0 0 1.55 1H19.5a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1Z" /></svg>;
    case "exit":
      return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>;
    case "chevron":
      return <svg {...common} width={14} height={14}><path d="M9 6l6 6-6 6" /></svg>;
    case "menu":
      return <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></svg>;
    default:
      return null;
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  // Gmail-style rail: always visible, icon-only when collapsed, icon+label
  // when expanded - not an overlay, so it never covers the page and the
  // hamburger button never moves or disappears either way.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState(DEFAULT_ROLE);
  const accountRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(ROLE_STORAGE_KEY) : null;
    const match = ROLE_LINKS.find((r) => r.href === stored);
    if (match) setRole(match);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) { setAccountOpen(false); setSwitchOpen(false); }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pickRole(r: typeof ROLE_LINKS[number]) {
    if (typeof window !== "undefined") window.localStorage.setItem(ROLE_STORAGE_KEY, r.href);
  }

  const sidebarLinks = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: role.href, label: role.label, icon: "user" },
    { href: "/work-history", label: "Work History", icon: "history" },
    { href: "/items", label: "Items", icon: "box" },
    { href: "/complaints", label: "Complaints", icon: "alert" },
    { href: "/form", label: "Form", icon: "file" },
    { href: "/po-out", label: "PO Out Recap", icon: "send" },
  ];

  return (
    <div className="shell">
      <div className="shell-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="shell-menu-btn" onClick={() => setSidebarOpen((v) => !v)} aria-label="Menu" aria-pressed={sidebarOpen}>
            <Icon name="menu" />
          </button>
          <a href="/dashboard" className="shell-brand">
            <img src="/logo.png" alt="Tempsens" style={{ height: 26, width: "auto" }} />
          </a>
        </div>

        <div className="shell-topbar-right">
          <div className="bell-wrap" ref={bellRef}>
            <button className="bell-btn" onClick={() => setBellOpen((v) => !v)} aria-label="Notifications">
              <Icon name="bell" />
            </button>
            {bellOpen && (
              <div className="bell-dropdown">
                <div style={{ padding: "10px 8px" }} className="subtle">No notifications yet.</div>
              </div>
            )}
          </div>

          <div className="account-wrap" ref={accountRef}>
            <button className="avatar-btn" onClick={() => setAccountOpen((v) => !v)} aria-label="Account menu">{role.initials}</button>
            {accountOpen && (
              <div className="account-dropdown">
                <div className="account-dropdown-head">
                  <span className="avatar-btn" style={{ cursor: "default" }}>{role.initials}</span>
                  <span className="account-dropdown-name">{role.label}</span>
                </div>

                {(
                  // Switch account / Settings open to every role for now
                  // while there's no real login yet and testing needs to
                  // move between roles freely - narrow this back to GM
                  // once real per-account login exists.
                  <>
                    <button className="account-menu-item" onClick={() => setSwitchOpen((v) => !v)}>
                      <Icon name="swap" /> Switch account
                      <span style={{ marginLeft: "auto", transform: switchOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}><Icon name="chevron" /></span>
                    </button>
                    {switchOpen && (
                      <div className="account-submenu">
                        {ROLE_LINKS.map((r) => (
                          <a key={r.href} href={r.href} className="account-submenu-item" onClick={() => pickRole(r)}>{r.label}</a>
                        ))}
                      </div>
                    )}
                    <a href="/settings" className="account-menu-item"><Icon name="gear" /> Settings</a>
                  </>
                )}
                <a href="/" className="account-menu-item"><Icon name="exit" /> Sign out</a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shell-body">
        <div className={sidebarOpen ? "shell-sidebar expanded" : "shell-sidebar"}>
          <div className="shell-sidebar-list">
            {sidebarLinks.map((l) => (
              <a
                key={l.label} href={l.href} title={l.label}
                className={pathname === l.href ? "shell-nav-item active" : "shell-nav-item"}
              >
                <span className="shell-nav-icon"><Icon name={l.icon} /></span>
                <span className="shell-nav-label">{l.label}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="shell-main">{children}</div>
      </div>
    </div>
  );
}

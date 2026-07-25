"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export default function NavBar({ active }: { active: "dashboard" | "job-orders" | "pricing" | "notifications" | "warehouse" | "stations" }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [userName, setUserName] = useState("");

  async function loadCount() {
    const res = await fetch("/api/notifications/count", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setCount(data.count);
    }
  }

  useEffect(() => {
    loadCount();
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUserName(d.profile?.full_name || d.profile?.email || ""));
    const interval = setInterval(loadCount, 30000); // refresh badge every 30s
    function onFocus() {
      loadCount();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function toggleBell() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications.slice(0, 8));
      }
    }
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    loadCount();
  }

  async function logOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="navbar">
      <div className="brand">
        <img src="/logo.png" alt="Tempsens" style={{ height: 26, width: "auto" }} />
        <h1>Tempsens System</h1>
      </div>

      <nav>
        <a href="/dashboard" className={active === "dashboard" ? "active" : ""}>Dashboard</a>
        <a href="/job-orders" className={active === "job-orders" ? "active" : ""}>Job Orders</a>
        <a href="/warehouse" className={active === "warehouse" ? "active" : ""}>Warehouse</a>
        <a href="/stations" className={active === "stations" ? "active" : ""}>Stations</a>
        <a href="/pricing" className={active === "pricing" ? "active" : ""}>Thermocouple Pricing</a>
      </nav>

      <div className="user-menu">
        <div className="bell-wrap">
          <button className="bell-btn" onClick={toggleBell} aria-label="Notifications">
            🔔
            {count > 0 && <span className="bell-badge">{count > 99 ? "99+" : count}</span>}
          </button>
          {open && (
            <div className="bell-dropdown">
              {!items ? (
                <p className="subtle" style={{ padding: 10 }}>Loading...</p>
              ) : items.length === 0 ? (
                <p className="subtle" style={{ padding: 10 }}>No notifications yet.</p>
              ) : (
                items.map((n) => (
                  <a
                    key={n.id}
                    href={n.link || "/notifications"}
                    className={`bell-item ${n.read ? "" : "unread"}`}
                    onClick={() => markRead(n.id)}
                  >
                    <div className="bell-item-title">{n.title}</div>
                    <div className="bell-item-msg">{n.message}</div>
                    <div className="bell-item-time">{new Date(n.created_at).toLocaleString()}</div>
                  </a>
                ))
              )}
              <a href="/notifications" className="bell-item" style={{ textAlign: "center", fontWeight: 700, color: "var(--accent-dark)" }}>
                View all
              </a>
            </div>
          )}
        </div>
        <span className="user-name">{userName}</span>
        <button className="btn secondary" onClick={logOut}>Log out</button>
      </div>
    </div>
  );
}

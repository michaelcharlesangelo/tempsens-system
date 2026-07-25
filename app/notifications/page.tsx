"use client";

import { useEffect, useState } from "react";
import NavBar from "@/app/components/NavBar";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  async function load() {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    const data = await res.json();
    setItems(data.notifications ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    load();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    load();
  }

  return (
    <>
      <NavBar active="notifications" />
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Notifications</h2>
          <button className="btn secondary" onClick={markAllRead}>Mark all read</button>
        </div>
        {!items ? (
          <p className="subtle">Loading...</p>
        ) : items.length === 0 ? (
          <p className="subtle">No notifications yet.</p>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid var(--panel-muted)",
                background: n.read ? "transparent" : "#fff7ed",
              }}
            >
              <a href={n.link || "#"} onClick={() => markRead(n.id)} style={{ textDecoration: "none", color: "var(--text)" }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{n.title}</div>
                <div className="subtle" style={{ marginTop: 2 }}>{n.message}</div>
                <div className="subtle" style={{ marginTop: 4, fontSize: "0.75rem" }}>{new Date(n.created_at).toLocaleString()}</div>
              </a>
            </div>
          ))
        )}
      </div>
    </>
  );
}

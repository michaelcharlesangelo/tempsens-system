"use client";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sales-manager", label: "Sales Manager" },
  { href: "/operation-manager", label: "Operational Manager" },
  { href: "/gm", label: "General Manager" },
  { href: "/production-manager", label: "Production Manager" },
  { href: "/warehouse-manager", label: "Warehouse Manager" },
  { href: "/products", label: "Products" },
  { href: "/complaints", label: "Complaints" },
];

export default function TabNav({ active }: { active: string }) {
  return (
    <div className="navbar">
      <div className="brand">
        <img src="/logo.png" alt="Tempsens" style={{ height: 26, width: "auto" }} />
        <h1>Tempsens System</h1>
      </div>
      <nav>
        {TABS.map((t) => (
          <a key={t.href} href={t.href} className={active === t.href ? "active" : ""}>{t.label}</a>
        ))}
        <a href="/admin" className={active === "/admin" ? "active" : ""} style={{ marginLeft: 10, opacity: 0.7 }}>Admin</a>
      </nav>
    </div>
  );
}

import { useState, useEffect } from "react";

const PALETTE = {
  bg: "#F0F2F7",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  accent: "#2563EB",
  accentSoft: "#EFF6FF",
  rewardFrom: "#0F4C81",
  rewardTo: "#1E88E5",
  rewardAccent: "#38BDF8",
  text: "#0D1117",
  textMid: "#4B5563",
  textMute: "#9CA3AF",
  green: "#10B981",
  amber: "#F59E0B",
  border: "rgba(0,0,0,0.06)",
};

const spring = "transition-all duration-200 ease-out";
const pressable =
  "active:scale-95 cursor-pointer select-none " + spring;

/* ─── tiny hook: count-up ─── */
function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

/* ─── Stat Card ─── */
function StatCard({ label, value, icon, accent, delay = 0 }) {
  const count = useCountUp(value, 700 + delay);
  return (
    <div
      className={`rounded-2xl p-4 flex flex-col gap-2 ${pressable}`}
      style={{
        background: accent ? PALETTE.accentSoft : PALETTE.surface,
        border: `1px solid ${PALETTE.border}`,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: accent ? PALETTE.accent : PALETTE.textMute, letterSpacing: "0.08em" }}
        >
          {label}
        </span>
        <span
          className="w-8 h-8 flex items-center justify-center rounded-xl text-base"
          style={{
            background: accent ? `${PALETTE.accent}18` : "#F3F4F6",
            color: accent ? PALETTE.accent : PALETTE.textMid,
          }}
        >
          {icon}
        </span>
      </div>
      <span
        className="text-4xl font-black tracking-tight leading-none"
        style={{ color: accent ? PALETTE.accent : PALETTE.text, fontVariantNumeric: "tabular-nums" }}
      >
        {count}
      </span>
    </div>
  );
}

/* ─── Activity Row ─── */
function ActivityRow({ name, time, isNew }) {
  return (
    <div
      className={`flex items-center gap-3 py-2.5 rounded-xl px-1 ${pressable} hover:bg-gray-50`}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${PALETTE.rewardAccent}44, ${PALETTE.accent}33)`,
          color: PALETTE.accent,
          border: `1.5px solid ${PALETTE.accent}22`,
        }}
      >
        {name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: PALETTE.text }}>
          {name}
        </p>
        <p className="text-xs" style={{ color: PALETTE.textMute }}>
          Stamp collected
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs font-medium" style={{ color: PALETTE.textMute }}>
          {time}
        </span>
        {isNew && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: `${PALETTE.green}18`, color: PALETTE.green }}
          >
            NEW
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Rewards Card ─── */
function RewardsCard() {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className={`rounded-3xl p-5 relative overflow-hidden ${pressable}`}
      style={{
        background: `linear-gradient(135deg, ${PALETTE.rewardFrom} 0%, ${PALETTE.rewardTo} 60%, ${PALETTE.rewardAccent} 100%)`,
        boxShadow: `0 16px 40px ${PALETTE.rewardTo}55, 0 4px 12px rgba(0,0,0,0.12)`,
      }}
    >
      {/* decorative blobs */}
      <div
        className="absolute -top-6 -right-6 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />
      <div
        className="absolute -bottom-8 -left-4 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: "rgba(255,255,255,0.05)" }}
      />
      {/* grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-white/60 mb-1">
              Rewards Program
            </p>
            <p className="text-white text-lg font-extrabold leading-tight">
              Total Issued
            </p>
          </div>
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${spring}`}
            style={{
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              transform: pulse ? "rotate(6deg) scale(1.05)" : "rotate(0deg) scale(1)",
            }}
          >
            🎁
          </div>
        </div>

        <div className="flex items-end gap-2 mb-5">
          <span className="text-6xl font-black text-white leading-none tracking-tight">
            0
          </span>
          <span className="text-white/50 text-sm mb-2 font-medium">rewards</span>
        </div>

        <div
          className="h-px w-full mb-4"
          style={{ background: "rgba(255,255,255,0.15)" }}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: PALETTE.rewardAccent }}
            />
            <span className="text-white/60 text-xs font-medium">
              No recent rewards
            </span>
          </div>
          <button
            className={`text-xs font-bold px-3 py-1.5 rounded-full ${pressable}`}
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            View All →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Bottom Nav ─── */
function NavItem({ icon, label, active }) {
  return (
    <button
      className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl flex-1 ${pressable}`}
      style={{
        color: active ? PALETTE.accent : PALETTE.textMute,
        background: active ? `${PALETTE.accent}0f` : "transparent",
      }}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span
        className="text-[10px] font-semibold"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </span>
      {active && (
        <div
          className="absolute bottom-0 w-4 h-0.5 rounded-full"
          style={{ background: PALETTE.accent }}
        />
      )}
    </button>
  );
}

/* ─── Main Dashboard ─── */
export default function StamplyDashboard() {
  const [activeTab, setActiveTab] = useState("Home");

  const tabs = [
    { icon: "🏠", label: "Home" },
    { icon: "👥", label: "Users" },
    { icon: "✅", label: "Visits" },
    { icon: "🎁", label: "Rewards" },
    { icon: "👤", label: "Profile" },
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#CBD5E1", fontFamily: "'DM Sans', sans-serif" }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      {/* Phone frame */}
      <div
        className="relative w-full max-w-sm overflow-hidden"
        style={{
          borderRadius: "40px",
          boxShadow:
            "0 40px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset",
          background: "#1a1a1a",
        }}
      >
        {/* Status bar */}
        <div
          className="flex items-center justify-between px-6 pt-4 pb-2"
          style={{ background: "#1a1a1a" }}
        >
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{
                  width: 3,
                  height: 6 + i * 2,
                  background: i < 4 ? "white" : "rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>
          <div className="w-20 h-5 rounded-full bg-black" />
          <div className="flex items-center gap-1">
            <span className="text-white text-xs font-semibold">LTE</span>
            <div
              className="rounded-sm"
              style={{ width: 22, height: 12, background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.4)", padding: 2 }}
            >
              <div className="h-full rounded-sm" style={{ width: "30%", background: "#ff4444" }} />
            </div>
          </div>
        </div>

        {/* Telegram header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ background: "#1a1a1a", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-blue-400 text-sm font-semibold">Close</span>
          <div className="text-center">
            <p className="text-white text-base font-bold leading-tight">Stamply</p>
            <p className="text-white/40 text-xs">mini app</p>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <span className="text-white/60 text-lg leading-none">⋯</span>
          </button>
        </div>

        {/* App body */}
        <div
          className="overflow-y-auto"
          style={{
            background: PALETTE.bg,
            maxHeight: "72vh",
            scrollbarWidth: "none",
          }}
        >
          <div className="px-4 pt-5 pb-6 space-y-4">

            {/* Page header */}
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: PALETTE.textMute }}>
                  Dashboard
                </p>
                <h1 className="text-2xl font-black" style={{ color: PALETTE.text }}>
                  My Business
                </h1>
              </div>
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${pressable}`}
                style={{
                  background: PALETTE.surface,
                  color: PALETTE.accent,
                  border: `1.5px solid ${PALETTE.accent}33`,
                  boxShadow: `0 2px 8px ${PALETTE.accent}18`,
                }}
              >
                <span>⬛</span> QR
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Pending" value={0} icon="🕐" delay={0} />
              <StatCard label="Customers" value={2} icon="👥" delay={100} />
            </div>
            <StatCard label="Visits Today" value={82} icon="📈" accent delay={200} />

            {/* Recent Activity */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: PALETTE.surface,
                border: `1px solid ${PALETTE.border}`,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-extrabold" style={{ color: PALETTE.text }}>
                  Recent Activity
                </h2>
                <span
                  className="text-xs font-semibold px-2 py-1 rounded-lg"
                  style={{ background: PALETTE.accentSoft, color: PALETTE.accent }}
                >
                  Today
                </span>
              </div>
              <ActivityRow name="G. Customer" time="05:37 PM" isNew />
              <ActivityRow name="G. Customer" time="05:37 PM" isNew={false} />
            </div>

            {/* Rewards Card */}
            <RewardsCard />

          </div>
        </div>

        {/* Bottom nav */}
        <div
          className="flex items-center relative"
          style={{
            background: PALETTE.surface,
            borderTop: `1px solid ${PALETTE.border}`,
            paddingBottom: "env(safe-area-inset-bottom, 12px)",
            paddingTop: 8,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={`flex flex-col items-center gap-0.5 py-1.5 flex-1 ${pressable}`}
              style={{
                color: activeTab === tab.label ? PALETTE.accent : PALETTE.textMute,
              }}
            >
              <span
                className={`text-xl ${spring}`}
                style={{
                  filter:
                    activeTab === tab.label
                      ? "drop-shadow(0 0 6px rgba(37,99,235,0.5))"
                      : "none",
                  transform: activeTab === tab.label ? "scale(1.15)" : "scale(1)",
                }}
              >
                {tab.icon}
              </span>
              <span
                className="text-[9px] font-bold"
                style={{
                  letterSpacing: "0.06em",
                  color: activeTab === tab.label ? PALETTE.accent : PALETTE.textMute,
                }}
              >
                {tab.label.toUpperCase()}
              </span>
              {activeTab === tab.label && (
                <div
                  className={`w-1 h-1 rounded-full ${spring}`}
                  style={{ background: PALETTE.accent }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Color palette legend */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 px-4 py-2 rounded-full"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
      >
        {[
          { color: PALETTE.accent, label: "Primary" },
          { color: PALETTE.rewardFrom, label: "Deep" },
          { color: PALETTE.rewardAccent, label: "Light" },
          { color: PALETTE.green, label: "Success" },
          { color: PALETTE.text, label: "Text" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-white/60 text-[10px] font-medium">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

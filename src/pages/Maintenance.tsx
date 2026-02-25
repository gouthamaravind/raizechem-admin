import { useEffect, useState } from "react";

const LEAVES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 8,
  duration: 6 + Math.random() * 6,
  size: 16 + Math.random() * 20,
  rotation: Math.random() * 360,
}));

export default function Maintenance() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-green-50 to-lime-50">
      {/* Animated falling leaves */}
      {LEAVES.map((leaf) => (
        <div
          key={leaf.id}
          className="pointer-events-none absolute top-0 animate-leaf-fall"
          style={{
            left: `${leaf.left}%`,
            animationDelay: `${leaf.delay}s`,
            animationDuration: `${leaf.duration}s`,
          }}
        >
          <svg
            width={leaf.size}
            height={leaf.size}
            viewBox="0 0 24 24"
            fill="none"
            style={{ transform: `rotate(${leaf.rotation}deg)` }}
          >
            <path
              d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5C5 14 8 12 12 12s7 2 8.7 5c.8-1.5 1.3-3.2 1.3-5C22 6.5 17.5 2 12 2z"
              fill="currentColor"
              className="text-emerald-400/40"
            />
            <path
              d="M12 12c-4 0-7 2-8.7 5C5.1 20.3 8.3 22 12 22s6.9-1.7 8.7-5C19 14 16 12 12 12z"
              fill="currentColor"
              className="text-green-500/30"
            />
          </svg>
        </div>
      ))}

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        {/* Animated plant icon */}
        <div className="relative">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-green-200 shadow-xl shadow-emerald-200/50 animate-pulse-gentle">
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-700"
            >
              {/* Sprout / seedling */}
              <path d="M12 22V12" />
              <path d="M12 12C12 12 8 8 4 8c0 4 4 8 8 8z" />
              <path d="M12 8C12 8 16 4 20 4c0 4-4 8-8 8z" />
              <path d="M12 12c0-2 1-4 2-5" />
              <path d="M12 12c0-2-1-4-2-5" />
            </svg>
          </div>
          {/* Growth rings */}
          <div className="absolute inset-0 animate-ping-slow rounded-full border-2 border-emerald-300/30" />
          <div className="absolute -inset-3 animate-ping-slower rounded-full border border-emerald-200/20" />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-emerald-900 sm:text-5xl">
            Growing Something Better
          </h1>
          <p className="mx-auto max-w-md text-lg text-emerald-700/80">
            We're nurturing improvements behind the scenes. Our system will be
            back stronger very soon.
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 rounded-full bg-white/70 px-5 py-2.5 shadow-sm backdrop-blur-sm border border-emerald-200/50">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          <span className="text-sm font-medium text-emerald-800">
            Maintenance in progress{dots}
          </span>
        </div>

        <p className="text-sm text-emerald-600/60">
          Raizechem — We'll be back shortly
        </p>
      </div>

      {/* Bottom landscape silhouette */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          className="w-full"
          preserveAspectRatio="none"
        >
          <path
            d="M0 120V80c120-20 240-40 360-35s240 30 360 35 240-15 360-25 240 5 360 15v50H0z"
            fill="currentColor"
            className="text-emerald-200/40"
          />
          <path
            d="M0 120V95c120-15 240-25 360-20s240 20 360 25 240-10 360-20 240 10 360 15v25H0z"
            fill="currentColor"
            className="text-emerald-300/30"
          />
        </svg>
      </div>
    </div>
  );
}

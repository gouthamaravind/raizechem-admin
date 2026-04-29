import { useEffect, useState } from "react";

export function useDutyTimer(startTime?: string | null) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (!startTime) {
      setElapsed("");
      return undefined;
    }

    const update = () => {
      const start = new Date(startTime).getTime();
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };

    update();
    timer = setInterval(update, 1000);
    return () => timer && clearInterval(timer);
  }, [startTime]);

  return elapsed;
}

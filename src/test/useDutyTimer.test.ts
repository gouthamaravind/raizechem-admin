import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDutyTimer } from "@/hooks/useDutyTimer";

describe("useDutyTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string when no start time", () => {
    const { result } = renderHook(() => useDutyTimer(null));
    expect(result.current).toBe("");
  });

  it("ticks forward from start time", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const start = new Date(now - 90_000).toISOString(); // 1m30s ago
    const { result } = renderHook(() => useDutyTimer(start));

    expect(result.current).toBe("00:01:30");

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current).toBe("00:02:00");
  });
});

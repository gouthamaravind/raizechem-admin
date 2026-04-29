import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    getCurrentPosition: vi.fn().mockRejectedValue(new Error("cap fail")),
  },
}));

const mockNavigator = {
  geolocation: {
    getCurrentPosition: vi.fn(),
  },
};

describe("useLocationCapture", () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.resetAllMocks();
    // @ts-expect-error test shim
    global.navigator = mockNavigator as Navigator;
  });

  afterEach(() => {
    // @ts-expect-error restore
    global.navigator = originalNavigator;
  });

  it("falls back to browser geolocation when Capacitor fails", async () => {
    const { useLocationCapture } = await import("@/hooks/useLocationCapture");
    const { getLocation } = useLocationCapture();

    const sample = { coords: { latitude: 1, longitude: 2, accuracy: 5 } } as GeolocationPosition;
    mockNavigator.geolocation.getCurrentPosition.mockImplementation((success) => {
      success(sample);
    });

    const loc = await getLocation();
    expect(loc.lat).toBe(1);
    expect(loc.lng).toBe(2);
    expect(loc.accuracy).toBe(5);
  });
});

import { Geolocation } from "@capacitor/geolocation";

export interface LocationPoint {
  lat: number;
  lng: number;
  accuracy: number;
}

export function useLocationCapture() {
  const getLocation = async (): Promise<LocationPoint> => {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    } catch (err) {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          (e) => reject(e),
          { enableHighAccuracy: true, timeout: 20000 }
        );
      });
    }
  };

  return { getLocation };
}

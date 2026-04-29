import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { LogOut, Camera } from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { supabase } from "@/integrations/supabase/client";

export default function MobileCheckout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const visitId = params.get("visit") || "";
  const dealerName = params.get("name") || "Dealer";
  const { checkoutVisit, loading } = useFieldOps();
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const PHOTO_BUCKET = "field-photos";

  const capturePhoto = async () => {
    try {
      const photo = await CapCamera.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        quality: 70,
      });
      if (!photo.base64String) return;
      setUploading(true);
      const fileName = `visits/${visitId || "visit"}-${Date.now()}.jpg`;
      const byteArray = Uint8Array.from(atob(photo.base64String), (c) => c.charCodeAt(0));
      const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(fileName, byteArray, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(fileName);
      setPhotoUrl(data.publicUrl);
      setPhotoPreview(`data:image/jpeg;base64,${photo.base64String}`);
      toast({ title: "Photo attached", description: "Checkout photo ready" });
    } catch (e: any) {
      const msg = e?.message || "Could not attach photo";
      if (msg.toLowerCase().includes("bucket") && msg.toLowerCase().includes("not found")) {
        toast({
          title: "Storage bucket missing",
          description: `Create a public bucket named "${PHOTO_BUCKET}" in Supabase Storage or update the bucket name in MobileCheckout.tsx.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Camera/Upload failed", description: msg, variant: "destructive" });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleCheckout = async () => {
    let lat: number | undefined, lng: number | undefined;
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    const { error } = await checkoutVisit(visitId, lat, lng, notes || undefined, photoUrl || undefined);
    if (error) {
      toast({ title: "Check-out failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "Checked Out", description: `Visit to ${dealerName} completed` });
      navigate("/m/dealers");
    }
  };

  return (
    <MobileLayout title="Check Out">
      <div className="space-y-6 max-w-md mx-auto">
        <div className="bg-card rounded-2xl p-6 border border-border text-center">
          <h2 className="text-lg font-bold text-foreground">{dealerName}</h2>
          <p className="text-sm text-muted-foreground">Ready to check out?</p>
        </div>

        <Input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-12 text-base"
        />

        <div className="space-y-3">
          {photoPreview && (
            <img src={photoPreview} alt="Checkout" className="w-full rounded-xl border" />
          )}
          <Button type="button" variant="secondary" className="w-full h-12 gap-2" onClick={capturePhoto} disabled={uploading}>
            <Camera className="h-4 w-4" />
            {uploading ? "Uploading..." : photoUrl ? "Retake Photo" : "Add Checkout Photo"}
          </Button>
        </div>

        <Button onClick={handleCheckout} variant="destructive" className="w-full h-14 text-base gap-2" disabled={loading}>
          <LogOut className="h-5 w-5" />
          Check Out
        </Button>
      </div>
    </MobileLayout>
  );
}

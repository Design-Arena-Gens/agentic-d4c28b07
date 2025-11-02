"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { students, studentIndex } from "@/data/students";
import type { AttendanceStatus } from "@/types/attendance";

type GeoState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; lat: number; lng: number; accuracy?: number }
  | { state: "error"; message: string };

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "detected"; value: string };

const statusOptions: AttendanceStatus[] = ["Hadir", "Izin", "Sakit", "Alpha"];

export function AttendanceCheckIn() {
  const [geoState, setGeoState] = useState<GeoState>({ state: "idle" });
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [status, setStatus] = useState<AttendanceStatus>("Hadir");
  const [notes, setNotes] = useState<string>("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (geoState.state !== "idle") return;

    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setGeoState({ state: "error", message: "Perangkat tidak mendukung geolocation" });
      return;
    }

    setGeoState({ state: "loading" });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoState({
          state: "success",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        setGeoState({
          state: "error",
          message:
            error.message || "Gagal mendapatkan lokasi. Izinkan akses lokasi pada browser Anda.",
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [geoState.state]);

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5QrcodeScanner | null = null;
    let isMounted = true;

    async function initScanner() {
      if (typeof window === "undefined") {
        return;
      }

      setScanState((prev) => (prev.status === "detected" ? prev : { status: "scanning" }));

      const html5qrcode = await import("html5-qrcode");
      const { Html5QrcodeScanner } = html5qrcode;

      scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          rememberLastUsedCamera: true,
        },
        false,
      );

      scanner.render(
        (decodedText: string) => {
          if (!isMounted) return;

          setScanState({ status: "detected", value: decodedText });

          const match = parseStudentId(decodedText);
          if (match) {
            setSelectedStudentId(match);
          }
        },
        () => {},
      );
    }

    initScanner();

    return () => {
      isMounted = false;
      if (scanner) {
        scanner.clear().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (scanState.status !== "detected") return;

    const timer = setTimeout(() => setScanState({ status: "scanning" }), 2500);
    return () => clearTimeout(timer);
  }, [scanState.status]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectedStudent = useMemo(
    () => (selectedStudentId ? studentIndex.get(selectedStudentId) ?? null : null),
    [selectedStudentId],
  );

  const handleSubmit = () => {
    if (!selectedStudent) {
      setToast({ type: "error", message: "Silakan pilih siswa terlebih dahulu" });
      return;
    }

    const payload = {
      studentId: selectedStudent.id,
      status,
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
      latitude: geoState.state === "success" ? geoState.lat : undefined,
      longitude: geoState.state === "success" ? geoState.lng : undefined,
      accuracy: geoState.state === "success" ? geoState.accuracy : undefined,
      qrData: scanState.status === "detected" ? scanState.value : undefined,
    };

    startTransition(async () => {
      try {
        const response = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const message = await response.json();
          throw new Error(message.error || "Gagal menyimpan absensi");
        }

        setToast({ type: "success", message: "Absensi berhasil tersimpan" });
        setNotes("");
        setStatus("Hadir");
        setScanState({ status: "scanning" });
      } catch (error) {
        setToast({ type: "error", message: (error as Error).message });
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Absensi QR Code</h1>
              <p className="text-sm text-slate-500">
                Scan QR code siswa dan konfirmasi status kehadiran dengan lokasi otomatis.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              {scanState.status === "detected" ? "QR terdeteksi" : "Menunggu scan"}
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div id="qr-reader" className="aspect-square w-full" />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium uppercase text-slate-500">Data QR Terakhir</p>
                <p className="break-all text-sm text-slate-700">
                  {scanState.status === "detected" ? scanState.value : "-"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Pilih Siswa
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  value={selectedStudentId}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                >
                  <option value="">Pilih siswa...</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} · {student.className}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  QR code berisi ID siswa. Pilih manual bila scan gagal.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-xs uppercase text-slate-500">Siswa</p>
                  <p className="font-medium text-slate-800">
                    {selectedStudent?.name ?? "Belum dipilih"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-xs uppercase text-slate-500">Kelas</p>
                  <p className="font-medium text-slate-800">
                    {selectedStudent?.className ?? "Belum dipilih"}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Status Kehadiran</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {statusOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={clsx(
                        "rounded-xl border px-3 py-2 text-sm font-medium transition",
                        status === option
                          ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                      onClick={() => setStatus(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Catatan
                </label>
                <textarea
                  className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Opsional, contohnya alasan izin atau keterangan sakit."
                />
              </div>

              <button
                type="button"
                className="flex w-full items-center justify-center rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={handleSubmit}
                disabled={isPending}
              >
                {isPending ? "Menyimpan..." : "Simpan Absensi"}
              </button>

              {toast && (
                <div
                  className={clsx(
                    "rounded-xl border px-3 py-2 text-sm font-medium",
                    toast.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-600",
                  )}
                >
                  {toast.message}
                </div>
              )}
            </div>
          </div>
        </section>

        <LocationPreview state={geoState} />
      </div>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Tips Absensi Cepat</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>Pastikan kamera bersih dan fokus pada QR code siswa.</li>
            <li>Gunakan jaringan internet stabil saat menyimpan absensi.</li>
            <li>
              Untuk kelas besar, gunakan tripod atau stand agar pemindaian lebih konsisten.
            </li>
            <li>
              Jika lokasi gagal didapat, periksa perizinan lokasi pada browser perangkat Anda.
            </li>
          </ul>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Data Lingkup</h2>
          <p className="mt-2 text-sm text-slate-600">
            Sistem menyimpan timestamp, lokasi, dan catatan untuk setiap absensi. Data
            tersinkron ke Google Sheets secara real-time ketika kredensial terset.
          </p>
        </section>
      </aside>
    </div>
  );
}

function parseStudentId(value: string) {
  const trimmed = value.trim();

  if (studentIndex.has(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/student(?:_|-)?id[:=]\s*(S\d{3})/i);
  if (match && studentIndex.has(match[1])) {
    return match[1];
  }

  return null;
}

function LocationPreview({ state }: { state: GeoState }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Lokasi Kehadiran</h2>
      <p className="mt-1 text-sm text-slate-500">
        Koordinat digunakan sebagai bukti lokasi siswa saat melakukan absensi.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LocationCard
          label="Status"
          value={{
            idle: "Menunggu izin",
            loading: "Mengambil lokasi...",
            success: "Lokasi aktif",
            error: "Lokasi dimatikan",
          }[state.state]}
          tone={state.state === "success" ? "success" : state.state === "error" ? "danger" : "muted"}
        />
        <LocationCard
          label="Latitude"
          value={state.state === "success" ? state.lat.toFixed(6) : "-"}
        />
        <LocationCard
          label="Longitude"
          value={state.state === "success" ? state.lng.toFixed(6) : "-"}
        />
        <LocationCard
          label="Akurasi"
          value={
            state.state === "success"
              ? state.accuracy
                ? `${Math.round(state.accuracy)} m`
                : "±"
              : "-"
          }
        />
      </div>
      {state.state === "error" && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {state.message}
        </p>
      )}
    </section>
  );
}

function LocationCard({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "success" | "danger";
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border p-4",
        {
          muted: "border-slate-200 bg-slate-50 text-slate-700",
          success: "border-emerald-200 bg-emerald-50 text-emerald-700",
          danger: "border-rose-200 bg-rose-50 text-rose-600",
        }[tone],
      )}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

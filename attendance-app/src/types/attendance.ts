export type AttendanceStatus = "Hadir" | "Izin" | "Sakit" | "Alpha";

export type AttendanceRecord = {
  timestamp: string;
  studentId: string;
  studentName: string;
  className: string;
  gender: "male" | "female";
  status: AttendanceStatus;
  notes?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  qrData?: string;
};

export type AttendanceFilters = {
  status?: AttendanceStatus | "Semua";
  className?: string;
  range?: "Minggu ini" | "Bulan ini" | "Semua";
};


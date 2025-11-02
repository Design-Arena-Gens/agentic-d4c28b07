"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { AttendanceRecord, AttendanceStatus } from "@/types/attendance";
import { students } from "@/data/students";
import { AttendanceSummary, calculateSummary, filterAttendance, paginate } from "@/lib/attendance";

type StatusFilter = AttendanceStatus | "Semua";
type RangeFilter = "Minggu ini" | "Bulan ini" | "Semua";

const statusFilters: StatusFilter[] = ["Semua", "Hadir", "Izin", "Sakit", "Alpha"];
const rangeFilters: RangeFilter[] = ["Minggu ini", "Bulan ini", "Semua"];

const genderColors = ["#0ea5e9", "#f97316"];
const statusColors: Record<AttendanceStatus, string> = {
  Hadir: "#22c55e",
  Izin: "#6366f1",
  Sakit: "#f97316",
  Alpha: "#ef4444",
};

const PAGE_SIZE = 10;

type AttendanceResponse =
  | { data: AttendanceRecord[] }
  | { error: string };

export function DashboardContent() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Semua");
  const [classFilter, setClassFilter] = useState<string>("");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("Minggu ini");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/attendance", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Gagal memuat data absensi");
        }

        const json = (await response.json()) as AttendanceResponse;
        if ("error" in json) {
          throw new Error(json.error);
        }

        if (!active) return;

        const sorted = [...json.data].sort(
          (a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime(),
        );

        setRecords(sorted);
      } catch (err) {
        if (!active) return;
        setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const filtered = filterAttendance(records, {
      status: statusFilter,
      className: classFilter || undefined,
      range: rangeFilter,
    });

    if (!search.trim()) {
      return filtered;
    }

    const keyword = search.trim().toLowerCase();
    return filtered.filter((record) => {
      return (
        record.studentName.toLowerCase().includes(keyword) ||
        record.studentId.toLowerCase().includes(keyword)
      );
    });
  }, [records, statusFilter, classFilter, rangeFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, classFilter, rangeFilter, search]);

  const { data: pageItems, totalPage } = useMemo(
    () => paginate(filteredRecords, page, PAGE_SIZE),
    [filteredRecords, page],
  );

  const summary = useMemo<AttendanceSummary>(() => calculateSummary(records), [records]);

  const genderChartData = [
    { name: "Putra", value: summary.totalMale },
    { name: "Putri", value: summary.totalFemale },
  ];

  const statusChartData = (Object.keys(summary.totalsByStatus) as AttendanceStatus[]).map(
    (status) => ({
      status,
      total: summary.totalsByStatus[status],
    }),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard Kehadiran</h1>
        <p className="text-sm text-slate-500">
          Rekap kehadiran siswa berdasarkan data yang tersimpan di Google Sheets.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Siswa Putra"
          value={summary.totalMale}
          description="Jumlah siswa laki-laki terdaftar"
        />
        <SummaryCard
          title="Siswa Putri"
          value={summary.totalFemale}
          description="Jumlah siswi perempuan terdaftar"
        />
        <SummaryCard
          title="Hadir Hari Ini"
          value={summary.presentToday}
          description="Total siswa hadir pada hari ini"
        />
        <SummaryCard
          title="Total Absensi"
          value={records.length}
          description="Seluruh data absensi tercatat"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Status Kehadiran</h2>
          <p className="text-sm text-slate-500">
            Distribusi status absensi untuk seluruh data yang terekam.
          </p>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="status" tick={{ fill: "#475569", fontSize: 12 }} />
                <YAxis tick={{ fill: "#475569", fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: "rgba(15, 23, 42, 0.05)" }}
                  contentStyle={{ borderRadius: 16, borderColor: "#e2e8f0" }}
                />
                <Legend />
                <Bar dataKey="total" radius={[12, 12, 0, 0]}>
                  {statusChartData.map((entry) => (
                    <Cell key={entry.status} fill={statusColors[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Komposisi Gender</h2>
          <p className="text-sm text-slate-500">Perbandingan jumlah siswa putra dan putri.</p>
          <div className="mt-6 h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={genderChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  stroke="none"
                  legendType="circle"
                >
                  {genderChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={genderColors[index % genderColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} siswa`, name]}
                  contentStyle={{ borderRadius: 16, borderColor: "#e2e8f0" }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Data Kehadiran</h2>
            <p className="text-sm text-slate-500">
              Tabel absensi dengan filter status, rentang tanggal, dan kelas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Cari nama atau ID siswa"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 sm:w-64"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            options={statusFilters}
          />
          <FilterSelect
            label="Rentang"
            value={rangeFilter}
            onChange={(value) => setRangeFilter(value as RangeFilter)}
            options={rangeFilters}
          />
          <FilterSelect
            label="Kelas"
            value={classFilter}
            onChange={(value) => setClassFilter(value)}
            options={["", ...new Set(students.map((student) => student.className))]}
            formatter={(value) => (value === "" ? "Semua kelas" : value)}
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Siswa</th>
                <th className="px-4 py-3 font-medium">Kelas</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Lokasi</th>
                <th className="px-4 py-3 font-medium">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    Memuat data absensi...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-rose-500">
                    {error}
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    Tidak ada data absensi yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                pageItems.map((record) => (
                  <tr key={`${record.studentId}-${record.timestamp}`}>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {format(parseISO(record.timestamp), "dd MMM yyyy HH:mm", {
                        locale: localeId,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{record.studentName}</div>
                      <div className="text-xs text-slate-500">{record.studentId}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{record.className}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {record.latitude && record.longitude
                        ? `${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {record.notes ? record.notes : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Menampilkan {(page - 1) * PAGE_SIZE + 1} -{" "}
            {Math.min(page * PAGE_SIZE, filteredRecords.length)} dari {filteredRecords.length} data
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
            >
              Sebelumnya
            </button>
            <span className="text-xs font-semibold text-slate-500">
              Halaman {page} / {totalPage}
            </span>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPage))}
              disabled={page === totalPage}
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  formatter,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  formatter?: (value: string) => string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-600">{label}</span>
      <select
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option || "all"} value={option}>
            {formatter ? formatter(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const color = statusColors[status];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      <span className="h-2 w-2 rounded-full bg-white/70" />
      {status}
    </span>
  );
}


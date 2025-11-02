import { NextRequest, NextResponse } from "next/server";
import { appendAttendance, getAttendance, sheetsConfigured } from "@/lib/googleSheets";
import { AttendanceRecord } from "@/types/attendance";
import { studentIndex } from "@/data/students";
import { generateMockAttendance } from "@/lib/mockData";

let fallbackData = generateMockAttendance();

export async function GET() {
  try {
    if (sheetsConfigured()) {
      const records = await getAttendance();
      return NextResponse.json({ data: records });
    }

    return NextResponse.json({ data: fallbackData });
  } catch (error) {
    console.error("[ATTENDANCE_GET]", error);
    return NextResponse.json({ error: "Failed to fetch attendance data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Partial<AttendanceRecord>;

    if (!payload.studentId || !payload.status || !payload.timestamp) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const student = studentIndex.get(payload.studentId);

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const record: AttendanceRecord = {
      timestamp: payload.timestamp,
      studentId: student.id,
      studentName: student.name,
      className: student.className,
      gender: student.gender,
      status: payload.status,
      notes: payload.notes ?? "",
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      qrData: payload.qrData,
    };

    if (sheetsConfigured()) {
      await appendAttendance(record);
    } else {
      fallbackData = [record, ...fallbackData];
    }

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("[ATTENDANCE_POST]", error);
    return NextResponse.json({ error: "Failed to submit attendance" }, { status: 500 });
  }
}


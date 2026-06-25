import { normalizeStatus as storeNormalizeStatus } from "../store/orderStatus";

// รวมสถานะของ pipeline หลังครัว (ready_for_delivery/picked_up/delivering) เข้ากลุ่ม "delivering"
// และของ legacy thai "ยกเลิก" เข้ากลุ่ม "cancelled" เพื่อให้สรุปยอด/นับจำนวนได้ถูกต้อง
// ไม่แก้ไฟล์อื่น แค่ "อ่าน" สถานะเพื่อจัดกลุ่มในมุม Admin เท่านั้น (ใช้สำหรับสรุปยอด 4 กลุ่มเท่านั้น
// ฟิลเตอร์ละเอียดใน OrdersPanel ยังใช้สถานะจริงทั้ง 8 ค่า)
const RIDER_DELIVERING_ALIASES = ["ready_for_delivery", "picked_up"];

export const adminNormalizeStatus = (status) => {
  if (RIDER_DELIVERING_ALIASES.includes(status)) return "delivering";
  if (status === "ยกเลิก") return "cancelled";
  return storeNormalizeStatus(status);
};

export const toDate = (value) => {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
};

export const isSameDay = (d, ref) =>
  d &&
  d.getDate() === ref.getDate() &&
  d.getMonth() === ref.getMonth() &&
  d.getFullYear() === ref.getFullYear();

export const isSameMonth = (d, ref) =>
  d && d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

export const formatDateTime = (value) => {
  const d = toDate(value);
  return d ? d.toLocaleString("th-TH") : "-";
};

// ---------- export helpers (CSV / Excel แบบไม่ต้องใช้ library เพิ่ม) ----------
const downloadFile = (content, filename, type) => {
  const blob = new Blob(["﻿" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToExcel = (rows, filename) => {
  if (!rows || rows.length === 0) {
    alert("ไม่มีข้อมูลให้ส่งออก");
    return;
  }
  const headers = Object.keys(rows[0]);
  const table =
    "<table><tr>" +
    headers.map((h) => `<th>${h}</th>`).join("") +
    "</tr>" +
    rows
      .map(
        (r) => "<tr>" + headers.map((h) => `<td>${r[h] ?? ""}</td>`).join("") + "</tr>"
      )
      .join("") +
    "</table>";
  downloadFile(table, filename, "application/vnd.ms-excel");
};

// คืนค่าเป็นวันตาม local time เช่น "2025-08-15"
export const dateKey = (v) => {
  const dt = new Date(v);
  if (Number.isNaN(dt)) return "";
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

export const sortSubwardsWithPriority = (list, ward) => {
  const PRIORITY = { อายุรกรรม: ["อายุรกรรม", "semi icu"] };
  const pri = PRIORITY[ward] || [];
  const rank = new Map(pri.map((name, i) => [String(name).toLowerCase(), i]));
  return [...(list || [])].sort((a, b) => {
    const al = String(a ?? "").toLowerCase();
    const bl = String(b ?? "").toLowerCase();
    const ai = rank.has(al) ? rank.get(al) : Infinity;
    const bi = rank.has(bl) ? rank.get(bl) : Infinity;
    if (ai !== bi) return ai - bi;
    return String(a).localeCompare(String(b), "th", { sensitivity: "base" });
  });
};

export const numFromKeys = (row, keys) => {
  for (const k of keys) {
    const v = parseFloat(row?.[k]);
    if (Number.isFinite(v)) return v;
  }
  return 0;
};

export const strFromKeys = (row, keys) => {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
};

// ✅ แปลงวันที่เป็น DD/MM/YYYY (พ.ศ.)
export const formatThaiDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d)) return "-"; // กัน parse ไม่ได้
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
};


export const fmt = (n) => (Number.isFinite(+n) ? +n : 0).toLocaleString("th-TH");

export const shiftLabel = (sh) =>
  sh === "morning" ? "เวรเช้า" : sh === "afternoon" ? "เวรบ่าย" : sh === "night" ? "เวรดึก" : "";

export const buildDateRange = (filters) => {
  const qs = new URLSearchParams();
  if (filters.startDate || filters.endDate) {
    const s = filters.startDate || filters.endDate;
    const e = filters.endDate || filters.startDate;
    qs.set("start", s);
    qs.set("end", e);
  } else if (filters.year && filters.month) {
    const y = Number(filters.year);
    const m = Number(filters.month);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    qs.set("start", start);
    qs.set("end", end);
  } else if (filters.year) {
    qs.set("start", `${filters.year}-01-01`);
    qs.set("end", `${filters.year}-12-31`);
  }
  return qs;
};

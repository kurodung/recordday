import React, { useMemo } from "react";
import { Filter, X } from "lucide-react";
import styles from "../../styles/Dashboard.module.css";

/* ------------------------- Helper: map options ------------------------- */
function toOptions(list) {
  return (list || []).map((it) =>
    typeof it === "object" ? it : { value: it, label: String(it) }
  );
}

/* ---------------------------- Component ---------------------------- */
export default function FilterPanel({
  filters,
  filterOptions,
  departments,
  onChangeFilter,
  onChangeDate,
  onClear,
  disabledFields = {}, // ✅ รองรับ prop disabledFields
  compareMode, // ✅ เพิ่ม
  setCompareMode, // ✅ เพิ่ม
}) {
  /* -------------------------- Static options -------------------------- */
  const shiftOptions = useMemo(
    () => [
      { value: "morning", label: "เวรเช้า" },
      { value: "afternoon", label: "เวรบ่าย" },
      { value: "night", label: "เวรดึก" },
    ],
    []
  );

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: new Date(0, i).toLocaleString("th-TH", { month: "long" }),
      })),
    []
  );

  const yearOptions = useMemo(
    () => toOptions(filterOptions?.years),
    [filterOptions?.years]
  );
  const deptOptions = useMemo(() => toOptions(departments), [departments]);
  const wardOptions = useMemo(
    () => toOptions(filterOptions?.wards),
    [filterOptions?.wards]
  );
  const subwardOpts = useMemo(
    () => toOptions(filterOptions?.subwards),
    [filterOptions?.subwards]
  );

  /* -------------------------- Field list -------------------------- */
  const fields = [
    {
      name: "startDate",
      label: "ตั้งแต่วันที่",
      type: "date",
      value: filters.startDate,
    },
    {
      name: "endDate",
      label: "ถึงวันที่",
      type: "date",
      value: filters.endDate,
    },
    {
      name: "shift",
      label: "เลือกเวร",
      type: "select",
      value: filters.shift,
      options: shiftOptions,
    },
    {
      name: "year",
      label: "เลือกปี",
      type: "select",
      value: filters.year,
      options: yearOptions,
    },
    {
      name: "month",
      label: "เลือกเดือน",
      type: "select",
      value: filters.month,
      options: monthOptions,
      disabled: !filters.year,
    },
    {
      name: "department",
      label: "เลือกกลุ่มงาน",
      type: "select",
      value: filters.department,
      options: deptOptions,
      disabled: disabledFields.department, // ✅ ล็อกเมื่อเป็น user
    },
    {
      name: "ward",
      label: "เลือก Ward",
      type: "select",
      value: filters.ward,
      options: wardOptions,
      disabled: disabledFields.ward, // ✅ ล็อกเมื่อเป็น user
    },
    {
      name: "subward",
      label: "เลือก Sub-ward",
      type: "select",
      value: filters.subward,
      options: subwardOpts,
      disabled:
        ((filterOptions?.subwards || []).length === 0 && !filters.ward) ||
        disabledFields.subward,
    },
  ];

  /* --------------------------- Render --------------------------- */
  return (
    <div className={styles.filterSection}>
      <div className={styles.filterHeader}>
        <Filter size={20} style={{ color: "#7e3cbd" }} />
        <h3 className={styles.filterTitle}>ตัวกรองข้อมูล</h3>
      </div>

      <div className={styles.filterGrid}>
        {/* ✅ เพิ่มตัวเลือกโหมดเปรียบเทียบ */}
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>โหมดเปรียบเทียบ</label>
          <select
            name="compareMode"
            value={compareMode}
            onChange={(e) => setCompareMode(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="shift">เปรียบเทียบ 3 เวร</option>
            <option value="month">เปรียบเทียบรายเดือน</option>
            <option value="year">เปรียบเทียบรายปี</option>
          </select>
        </div>

        {fields.map((field) => (
          <div
            key={field.name}
            className={`${styles.filterItem} ${
              field.disabled ? styles.disabledField : ""
            }`}
          >
            <label className={styles.filterLabel}>{field.label}</label>
            {field.type === "date" ? (
              <input
                type="date"
                lang="th-TH"
                name={field.name}
                value={field.value}
                onChange={onChangeDate}
                min={
                  field.name === "endDate" && filters.startDate
                    ? filters.startDate
                    : undefined
                }
                className={styles.filterInput}
                onFocus={(e) => {
                  if (typeof e.target.showPicker === "function") {
                    e.target.showPicker();
                  }
                }}
                disabled={field.disabled}
              />
            ) : (
              <select
                name={field.name}
                value={field.value}
                onChange={onChangeFilter}
                disabled={field.disabled}
                className={styles.filterSelect}
              >
                <option value="">ทั้งหมด</option>
                {(field.options || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}

        <button onClick={onClear} className={styles.clearFiltersBtn}>
          <X size={16} /> ล้างตัวกรอง
        </button>
      </div>
    </div>
  );
}

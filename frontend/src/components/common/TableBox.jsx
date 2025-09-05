import React from "react";

const tableStyle = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" };
const thStyle = { padding: 8, borderBottom: "1px solid #e5e7eb", textAlign: "center", whiteSpace: "nowrap" };
const tdStyle = { padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "center", verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis" };

export default function TableBox({ headers = [], rows = [] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>{headers.map((h, i) => <th key={i} style={thStyle}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => <td key={ci} style={tdStyle}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

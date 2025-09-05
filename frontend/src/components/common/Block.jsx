import React from "react";
import { RefreshCw } from "lucide-react";

export default function Block({ styles, title, loading, error, empty, footer, children }) {
  return (
    <div className={`${styles.chartContainer} ${styles.fullWidthChart}`}>
      <h3 className={styles.chartTitle}>{title}</h3>

      {loading && (
        <div className={styles.loadingContainer} style={{ height: 80 }}>
          <RefreshCw className={styles.loadingSpinner} size={20} />
          <span className={styles.loadingText}>กำลังโหลดข้อมูล...</span>
        </div>
      )}

      {!loading && error && <div className={styles.errorContainer}>{error}</div>}

      {!loading && !error && empty && (
        <div className={styles.loadingContainer} style={{ height: 80 }}>
          <span className={styles.loadingText}>ไม่มีข้อมูลตามตัวกรอง</span>
        </div>
      )}

      {!loading && !error && !empty && (
        <>
          {children}
          {footer}
        </>
      )}
    </div>
  );
}
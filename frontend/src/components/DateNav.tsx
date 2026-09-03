"use client";

import { useRouter } from "next/navigation";
import styles from "./DateNav.module.css";

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DateNav({
  currentDate,
  today,
}: {
  currentDate: string;
  today: string;
}) {
  const router = useRouter();

  function goTo(date: string) {
    router.push(date === today ? "/" : `/?date=${date}`);
  }

  return (
    <div className={styles.nav}>
      <button
        type="button"
        onClick={() => goTo(shiftDate(currentDate, -1))}
        aria-label="Предишен ден"
      >
        ‹
      </button>
      <input
        type="date"
        value={currentDate}
        onChange={(e) => e.target.value && goTo(e.target.value)}
        aria-label="Избери дата"
      />
      <button
        type="button"
        onClick={() => goTo(shiftDate(currentDate, 1))}
        aria-label="Следващ ден"
      >
        ›
      </button>
      {currentDate !== today && (
        <button type="button" className={styles.today} onClick={() => goTo(today)}>
          Днес
        </button>
      )}
    </div>
  );
}

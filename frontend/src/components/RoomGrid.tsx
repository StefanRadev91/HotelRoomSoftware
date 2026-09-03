"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Booking, RoomWithStatus } from "@/lib/strapi";
import styles from "./RoomGrid.module.css";

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("bg-BG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function RoomGrid({
  rooms,
  isAuthenticated,
  viewedDate,
  today,
}: {
  rooms: RoomWithStatus[];
  isAuthenticated: boolean;
  viewedDate: string;
  today: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<RoomWithStatus | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [router]);

  const occupiedCount = rooms.filter((r) => r.booking).length;
  const close = () => setSelected(null);
  const onSaved = () => {
    close();
    router.refresh();
  };

  return (
    <>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.free}`} />
          Свободна
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.occupied}`} />
          Заета
        </span>
        <span className={styles.legendCount}>
          {occupiedCount} от {rooms.length} стаи са заети{" "}
          {viewedDate === today ? "днес" : `на ${formatDate(viewedDate)}`}
        </span>
      </div>

      <div className={styles.grid}>
        {rooms.map(({ room, booking }) => {
          const clickable = Boolean(booking) || isAuthenticated;
          const statusClass = booking ? styles.occupied : styles.free;
          const label = booking
            ? `Стая ${room.number}, заета от ${formatDate(booking.date_from)} до ${formatDate(booking.date_to)}`
            : `Стая ${room.number}, свободна${isAuthenticated ? " — създай резервация" : ""}`;

          if (!clickable) {
            return (
              <div
                key={room.id}
                className={`${styles.room} ${statusClass}`}
                aria-label={label}
              >
                {room.number}
              </div>
            );
          }

          return (
            <button
              key={room.id}
              type="button"
              className={`${styles.room} ${statusClass}`}
              onClick={() => setSelected({ room, booking })}
              aria-haspopup="dialog"
              aria-label={label}
            >
              {room.number}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className={styles.overlay} role="presentation" onClick={close}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.close}
              onClick={close}
              aria-label="Затвори"
            >
              ×
            </button>
            <h2 id="booking-modal-title">Стая {selected.room.number}</h2>

            {isAuthenticated ? (
              <>
                <BookingForm
                  roomWithStatus={selected}
                  defaultDate={viewedDate}
                  onSaved={onSaved}
                />
                <RoomHistory roomDocumentId={selected.room.documentId} />
              </>
            ) : selected.booking ? (
              <>
                <p className={styles.modalPeriod}>
                  <span>От</span>
                  <strong>{formatDate(selected.booking.date_from)}</strong>
                </p>
                <p className={styles.modalPeriod}>
                  <span>До</span>
                  <strong>{formatDate(selected.booking.date_to)}</strong>
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function BookingForm({
  roomWithStatus: { room, booking },
  defaultDate,
  onSaved,
}: {
  roomWithStatus: RoomWithStatus;
  defaultDate: string;
  onSaved: () => void;
}) {
  const [dateFrom, setDateFrom] = useState(booking?.date_from ?? defaultDate);
  const [dateTo, setDateTo] = useState(booking?.date_to ?? "");
  const [guestNote, setGuestNote] = useState(booking?.guest_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (dateTo < dateFrom) {
      setError("Крайната дата трябва да е след началната.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const url = booking ? `/api/bookings/${booking.documentId}` : "/api/bookings";
      const res = await fetch(url, {
        method: booking ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: room.documentId,
          date_from: dateFrom,
          date_to: dateTo,
          guest_note: guestNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Възникна грешка.");
        return;
      }
      onSaved();
    } finally {
      setPending(false);
    }
  }

  async function handleCancelBooking() {
    if (!booking) return;
    if (!window.confirm(`Да отменя ли резервацията за стая ${room.number}?`)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.documentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Възникна грешка.");
        return;
      }
      onSaved();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.bookingForm} onSubmit={handleSubmit}>
      <label>
        От
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          required
        />
      </label>
      <label>
        До
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => setDateTo(e.target.value)}
          required
        />
      </label>
      <label>
        Бележка за госта
        <textarea
          value={guestNote ?? ""}
          onChange={(e) => setGuestNote(e.target.value)}
          rows={2}
          placeholder="По желание"
        />
      </label>

      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.formButtons}>
        <button type="submit" className={styles.primaryButton} disabled={pending}>
          {booking ? "Запази промените" : "Създай резервация"}
        </button>
        {booking && (
          <button
            type="button"
            className={styles.dangerButton}
            onClick={handleCancelBooking}
            disabled={pending}
          >
            Откажи резервацията
          </button>
        )}
      </div>
    </form>
  );
}

function RoomHistory({ roomDocumentId }: { roomDocumentId: string }) {
  const [entries, setEntries] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    fetch(`/api/bookings/history?room=${roomDocumentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setEntries(data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Неуспешно зареждане на историята.");
      });
    return () => {
      cancelled = true;
    };
  }, [roomDocumentId]);

  if (error) return <p className={styles.formError}>{error}</p>;
  if (!entries || entries.length === 0) return null;

  return (
    <div className={styles.history}>
      <h3>История</h3>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.historyEntry}>
            <span className={styles.historyDates}>
              {formatDate(entry.date_from)} – {formatDate(entry.date_to)}
              {entry.status === "cancelled" && (
                <span className={styles.historyCancelled}> (отказана)</span>
              )}
            </span>
            {entry.guest_note && (
              <span className={styles.historyNote}>{entry.guest_note}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

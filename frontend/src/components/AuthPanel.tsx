"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./AuthPanel.module.css";

export default function AuthPanel({ email }: { email: string | null }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Неуспешен вход");
        return;
      }
      setShowForm(false);
      setPassword("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  if (email) {
    return (
      <div className={styles.panel}>
        <span className={styles.email}>{email}</span>
        <button type="button" className={styles.linkButton} onClick={handleLogout}>
          Изход
        </button>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => setShowForm(true)}
      >
        Вход за администратори
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Потребител или имейл"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        required
        autoFocus
      />
      <input
        type="password"
        placeholder="Парола"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <div className={styles.formActions}>
        <button type="submit" disabled={pending}>
          {pending ? "..." : "Влез"}
        </button>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            setShowForm(false);
            setError(null);
          }}
        >
          Отказ
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}

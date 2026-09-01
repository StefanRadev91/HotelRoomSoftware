import AuthPanel from "@/components/AuthPanel";
import RoomGrid from "@/components/RoomGrid";
import { getRoomGrid } from "@/lib/strapi";
import { getSession } from "@/lib/session";
import styles from "./page.module.css";

export default async function Home() {
  const session = await getSession();
  const rooms = await getRoomGrid(session?.token);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Хотелско крило на манастира</p>
          <h1>Заетост на стаите</h1>
          <p className={styles.subtitle}>
            {session
              ? "Кликни върху стая, за да създадеш или редактираш резервация."
              : "Изберете заета стая, за да видите периода на резервацията."}
          </p>
        </div>
        <AuthPanel email={session?.email ?? null} />
      </header>

      <main>
        <RoomGrid rooms={rooms} isAuthenticated={Boolean(session)} />
      </main>
    </div>
  );
}

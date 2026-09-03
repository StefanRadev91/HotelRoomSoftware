import AuthPanel from "@/components/AuthPanel";
import DateNav from "@/components/DateNav";
import RoomGrid from "@/components/RoomGrid";
import { getRoomGrid, todayISODate } from "@/lib/strapi";
import { getSession } from "@/lib/session";
import styles from "./page.module.css";

function parseDateParam(value: string | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return todayISODate();
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { date } = await searchParams;
  const viewedDate = parseDateParam(typeof date === "string" ? date : undefined);
  const today = todayISODate();

  const session = await getSession();
  const rooms = await getRoomGrid(session?.token, viewedDate);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Хотелско крило на Бачковския манастир „Успение Богородично“
          </p>
          <h1>Заетост на стаите</h1>
          <p className={styles.subtitle}>
            {session
              ? "Кликни върху стая, за да създадеш или редактираш резервация."
              : "Изберете заета стая, за да видите периода на резервацията."}
          </p>
        </div>
        <AuthPanel email={session?.email ?? null} />
      </header>

      <main className={styles.main}>
        <DateNav currentDate={viewedDate} today={today} />
        <RoomGrid
          rooms={rooms}
          isAuthenticated={Boolean(session)}
          viewedDate={viewedDate}
          today={today}
        />
      </main>
    </div>
  );
}

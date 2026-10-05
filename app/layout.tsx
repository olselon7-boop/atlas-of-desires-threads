import type { ReactNode } from "react";
import "./globals.css";
export const metadata = { title: "Атлас желаний — память о будущем", description: "Исследовательский корпус публично высказанных мечтаний для художественного проекта «Атлас желаний»." };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
